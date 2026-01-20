# User Management Guide

## Overview

This guide explains how to manage user credentials in the BookACut system:
- **Super Admin** sets credentials for **Client Admins** (in `platform_db`)
- **Client Admin** sets credentials for **Staff** (in their client database)
- **Customers** register themselves (in client database)

## Architecture

### Database Structure

- **Platform Database (`platform_db`)**:
  - Platform super admin users
  - Client admin metadata (subscription, limits, etc.)

- **Client Databases (`client_*_db`)**:
  - Client admin users (stored in their own database)
  - Staff users (stored in client database)
  - Customer users (stored in client database)

## Super Admin → Client Admin

### Creating Client Admin

When creating a new client admin, you specify their credentials. The system automatically:
1. Creates client admin metadata in `platform_db`
2. Creates a new client database
3. Creates client admin user in the client database
4. Initializes default roles in the client database

```bash
POST /api/super-admin/tenants
```

**Request Body:**
```json
{
  "email": "admin@abcsalon.com",
  "phone": "1234567890",
  "adminPassword": "SecurePassword123!",
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "subscriptionPlan": "premium",
  "maxShops": 10
}
```

**Response:**
```json
{
  "success": true,
  "client": {
    "clientId": "64fa2c9e...",
    "databaseName": "client_64fa2c9e_db",
    "email": "admin@abcsalon.com"
  },
  "adminUser": {
    "email": "admin@abcsalon.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "message": "Client admin and database created successfully"
}
```

### Updating Client Admin Details

Super admin can update client admin subscription and limits:

```bash
PUT /api/super-admin/tenants/:clientId
```

**Request Body:**
```json
{
  "maxShops": 20,
  "maxStaff": 100,
  "subscriptionPlan": "enterprise",
  "isActive": true
}
```

**Note:** To change client admin password, you would need to access their client database. This can be added as a feature if needed.

## Client Admin → Staff

### Adding Staff with Credentials

When adding staff to a shop, client admin sets their username (email) and password. Staff users are created in the client's database:

```bash
POST /api/admin/shops/:shopId/staff
```

**Request Body:**
```json
{
  "email": "staff@abcsalon.com",
  "password": "StaffPassword123!",
  "phone": "9876543210",
  "firstName": "Jane",
  "lastName": "Stylist",
  "specialization": ["haircut", "coloring"],
  "hourlyRate": 25,
  "commissionRate": 10
}
```

**Required Fields:**
- `email` - Staff email/username (must be unique within client database)
- `password` - Password (min 6 characters)
- `phone` - Phone number
- `firstName` - First name
- `lastName` - Last name

**Optional Fields:**
- `specialization` - Array of specializations
- `hourlyRate` - Hourly rate
- `commissionRate` - Commission percentage

### Updating Staff Password

Client admin can update staff password:

```bash
PUT /api/admin/shops/:shopId/staff/:staffId/password
```

**Request Body:**
```json
{
  "password": "NewStaffPassword123!"
}
```

### Updating Staff Credentials

Client admin can update multiple staff credentials at once:

```bash
PUT /api/admin/shops/:shopId/staff/:staffId/credentials
```

**Request Body:**
```json
{
  "email": "newemail@abcsalon.com",
  "password": "NewPassword123!",
  "phone": "9876543210",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Note:** All fields are optional. Only include fields you want to update.

## Customer Registration

Customers register themselves in the client database:

```bash
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "customer@example.com",
  "password": "CustomerPass123!",
  "phone": "555-1234",
  "firstName": "John",
  "lastName": "Customer",
  "databaseName": "client_64fa2c9e_db"
}
```

**Required Fields:**
- `email` - Customer email (must be unique within client database)
- `password` - Password (min 6 characters)
- `phone` - Phone number
- `firstName` - First name
- `lastName` - Last name
- `databaseName` - The client's database name (obtained from client admin or public info)

**Note:** `databaseName` is required because the system needs to know which client database to create the user in.

## Workflow Examples

### Example 1: Complete Client Setup

1. **Super Admin creates client admin:**
   ```bash
   POST /api/super-admin/tenants
   {
     "email": "admin@beautysalon.com",
     "phone": "555-1234",
     "adminPassword": "AdminPass123!",
     "adminFirstName": "Sarah",
     "adminLastName": "Manager"
   }
   ```
   Response includes `databaseName`: `client_64fa2c9e_db`

2. **Client Admin logs in:**
   ```bash
   POST /api/auth/login
   {
     "email": "admin@beautysalon.com",
     "password": "AdminPass123!"
   }
   ```
   JWT token includes `databaseName` automatically

3. **Client Admin creates shop:**
   ```bash
   POST /api/admin/shops
   {
     "name": "Main Street Location",
     "phone": "555-5678"
   }
   ```

4. **Client Admin adds staff:**
   ```bash
   POST /api/admin/shops/SHOP_ID/staff
   {
     "email": "stylist1@beautysalon.com",
     "password": "StaffPass123!",
     "phone": "555-9999",
     "firstName": "Mike",
     "lastName": "Stylist"
   }
   ```

5. **Customer registers (using databaseName from step 1):**
   ```bash
   POST /api/auth/register
   {
     "email": "customer@example.com",
     "password": "CustomerPass123!",
     "phone": "555-1111",
     "firstName": "Jane",
     "lastName": "Doe",
     "databaseName": "client_64fa2c9e_db"
   }
   ```

### Example 2: Password Reset Flow

**Client Admin resets staff password:**
```bash
PUT /api/admin/shops/SHOP_ID/staff/STAFF_ID/password
{
  "password": "NewStaffPassword123!"
}
```

**Note:** Customer password reset would need to be implemented separately if required.

## Authentication Flow

### Platform Super Admin Login

1. User logs in with email and password
2. System checks `platform_db` for platform admin
3. If found, returns JWT with role `platform_super_admin`
4. Token does not include `databaseName` (uses `platform_db`)

### Client User Login (Admin, Staff, Customer)

1. User logs in with email and password
2. System checks `platform_db` for client admin metadata
3. Gets `databaseName` from client admin record
4. Connects to client database and verifies user
5. Returns JWT with role and `databaseName`
6. All subsequent requests use `databaseName` to route to correct database

### JWT Token Structure

**Platform Super Admin:**
```json
{
  "id": "user_id",
  "role": "platform_super_admin"
}
```

**Client User:**
```json
{
  "id": "user_id",
  "role": "client_admin" | "staff" | "customer",
  "databaseName": "client_64fa2c9e_db"
}
```

## Security Best Practices

1. **Strong Passwords:**
   - Minimum 6 characters (enforced)
   - Use mix of uppercase, lowercase, numbers, and symbols
   - Don't reuse passwords

2. **Email as Username:**
   - Email serves as username for login
   - Must be unique within database (platform or client)
   - Use professional email addresses

3. **Password Management:**
   - Super admin controls client admin creation
   - Client admin controls staff passwords
   - Customers set their own passwords

4. **Access Control:**
   - Super admin can only manage client admin metadata
   - Client admin can only manage their own database
   - Staff cannot manage other users
   - Customers cannot manage anyone

5. **Database Isolation:**
   - Each client database is completely separate
   - No cross-database access possible
   - JWT tokens route to correct database automatically

## API Response Examples

### Success Response
```json
{
  "success": true,
  "message": "Staff password updated successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Password must be at least 6 characters"
}
```

## Common Errors

1. **Email Already Exists:**
   - Error: "User with this email already exists"
   - Solution: Use a different email address

2. **Weak Password:**
   - Error: "Password must be at least 6 characters"
   - Solution: Use a stronger password

3. **User Not Found:**
   - Error: "Client admin user not found" or "Staff not found"
   - Solution: Verify the user ID and database

4. **Unauthorized:**
   - Error: "Access denied"
   - Solution: Ensure you're logged in with correct role

5. **Database Not Found:**
   - Error: "Database name not found in token" or "Database not found"
   - Solution: Verify client admin exists and database was created

6. **Invalid Database Name:**
   - Error: "Invalid database name"
   - Solution: Ensure `databaseName` matches client admin's database

## Notes

- Passwords are automatically hashed using bcrypt
- Email addresses are normalized (lowercase)
- User accounts are database-scoped (email can be reused across databases)
- Staff can be assigned to multiple shops (same user, different StaffProfile)
- Inactive staff can be reactivated (preserves user account)
- Platform super admin never accesses client databases directly
- Client admin users are stored in their own client database (not platform_db)
- JWT tokens automatically route requests to the correct database
- No `tenantId` fields needed - database isolation provides separation
