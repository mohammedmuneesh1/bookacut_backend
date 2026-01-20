# Client Admin Management Guide

## Overview

Platform super admin creates client admins, and the system automatically creates a dedicated database for each client. Each client admin can deploy their software on their own domain. Super admin manages all client admin details, shops (via queries), and subscription expiry.

## Architecture

### Database Structure

- **Platform Database (`platform_db`)**: 
  - Platform super admin users
  - Client admin metadata and subscription info
  - Client ID to database name mapping
  
- **Client Databases (`client_*_db`)**:
  - Each client gets a unique database (e.g., `client_64fa2c9e_db`)
  - All client data stored here (shops, users, bookings, invoices, etc.)
  - Complete data isolation from other clients

## Workflow

### 1. Super Admin Creates Client Admin

Super admin creates a new client admin with credentials. The system automatically:
- Creates client admin record in `platform_db`
- Creates a new client database (e.g., `client_64fa2c9e_db`)
- Initializes the database with default roles
- Creates client admin user in the client database

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
  "maxShops": 10,
  "maxStaff": 50
}
```

**Required Fields:**
- `email` - Client admin email (unique identifier)
- `phone` - Phone number
- `adminPassword` - Client admin password (min 6 characters)
- `adminFirstName` - Client admin first name
- `adminLastName` - Client admin last name

**Optional Fields:**
- `subscriptionPlan` - Plan type (basic/premium/enterprise, default: basic)
- `maxShops` - Maximum shops allowed (default: 10)
- `maxStaff` - Maximum staff allowed (default: 50)

**Response:**
```json
{
  "success": true,
  "message": "Client admin and database created successfully with 3-day demo period",
  "client": {
    "clientId": "64fa2c9e...",
    "databaseName": "client_64fa2c9e_db",
    "email": "admin@abcsalon.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "1234567890",
    "maxShops": 10,
    "maxStaff": 50,
    "subscriptionPlan": "premium",
    "subscriptionExpiresAt": "2024-01-18T00:00:00.000Z",
    "daysUntilExpiry": 3,
    "isActive": true,
    "createdAt": "2024-01-15T00:00:00.000Z"
  },
  "adminUser": {
    "email": "admin@abcsalon.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "1234567890"
  }
}
```

### 2. Demo Period

- **Duration:** 3 days from client admin creation
- **Features:** Full access to all features
- **Limitations:** 
  - Max shops: 10 (or specified maxShops)
  - Max staff: 50 (or specified maxStaff)
  - Basic plan features (unless premium/enterprise specified)
- **Expiry:** After 3 days, access is blocked until payment

### 3. Client Admin Login

Client admin logs in with credentials set by super admin:

```bash
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "admin@abcsalon.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "...",
    "email": "admin@abcsalon.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "client_admin",
    "databaseName": "client_64fa2c9e_db",
    "permissions": [...]
  }
}
```

**Important:** The JWT token includes `databaseName` which is used by the middleware to route requests to the correct database.

### 4. Client Admin Deploys on Own Domain

Each client admin can:
- Deploy the frontend on their own domain
- Use their own branding
- Customize the software for their business
- All data remains isolated in their database

### 5. Super Admin Views All Client Admins

Super admin can view all client admins with complete details:

```bash
GET /api/super-admin/tenants
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by name or email
- `status` - Filter by active/inactive

**Response:**
```json
{
  "success": true,
  "tenants": [
    {
      "_id": "...",
      "clientId": "64fa2c9e...",
      "databaseName": "client_64fa2c9e_db",
      "email": "admin@abcsalon.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "1234567890",
      "shopCount": 5,
      "totalShops": 5,
      "isSubscriptionActive": true,
      "isExpired": false,
      "isDemoPeriod": true,
      "daysUntilExpiry": 2,
      "subscriptionStartDate": "2024-01-15T00:00:00.000Z",
      "subscriptionExpiryDate": "2024-01-18T00:00:00.000Z",
      "subscriptionPlan": "premium",
      "maxShops": 10,
      "maxStaff": 50
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

**Note:** Shop counts are fetched by querying the client's database.

### 6. Super Admin Views Client Admin Details

Get complete information about a specific client admin:

```bash
GET /api/super-admin/tenants/:clientId
```

**Response includes:**
- Complete client admin information
- Active and total shop counts (queried from client database)
- Subscription status and expiry details
- Admin user details
- Recent payment history
- Demo period status

### 7. Payment Recording

When client admin pays, super admin records payment:

```bash
POST /api/super-admin/tenants/:clientId/payments
```

**Request Body:**
```json
{
  "amount": 99.99,
  "currency": "USD",
  "paymentMethod": "bank_transfer",
  "subscriptionPeriod": 1,
  "paymentDate": "2024-01-17",
  "receiptNumber": "REC-2024-001",
  "notes": "Monthly subscription payment"
}
```

**What happens:**
- Payment is recorded in history (in `platform_db`)
- Subscription expiry extends automatically
- If expired: new expiry = today + period
- If active: new expiry = current expiry + period

**Example:**
- Current expiry: Jan 18, 2024
- Payment period: 1 month
- New expiry: Feb 18, 2024

## Multi-Domain Deployment

### Architecture

Each client admin can deploy their own frontend:

```
Platform Backend (bookacut.com/api)
    ├── Client Admin 1 (abcsalon.com) → Uses bookacut.com/api
    ├── Client Admin 2 (xyzsalon.com) → Uses bookacut.com/api
    └── Client Admin 3 (beautysalon.com) → Uses bookacut.com/api
```

### Frontend Configuration

Each client admin's frontend should:

1. **Set API Base URL:**
   ```javascript
   const API_BASE_URL = 'https://bookacut.com/api';
   ```

2. **Authentication:**
   - Client admin logs in via API
   - Receives JWT token with `databaseName`
   - Token automatically routes requests to correct database

3. **Custom Branding:**
   - Each domain can have custom branding
   - Logo, colors, name can be client-specific
   - Data remains isolated in client database

### Security

- All API calls require JWT authentication
- Database isolation enforced at backend level
- Client admin can only access their own database
- Super admin can access all client metadata (but not client data directly)
- JWT tokens include `databaseName` for routing

## Subscription Management

### Demo Period Features

- **Duration:** 3 days
- **Full Access:** All features available
- **Shop Limit:** 10 shops (configurable)
- **Staff Limit:** 50 staff (configurable)
- **Auto-Expiry:** Blocks access after 3 days

### After Demo Expires

- Client admin operations blocked
- Super admin must record payment
- System shows expiry status
- Payment extends expiry automatically

### Subscription Plans

- **Basic:** Standard features
- **Premium:** Advanced features
- **Enterprise:** Full features + custom limits

## Database Isolation

### Platform Database (`platform_db`)
- Stores platform super admin users
- Stores client admin metadata (subscription, limits, etc.)
- Maps client IDs to database names
- **NO client business data stored here**

### Client Databases (`client_*_db`)
- Each client has a completely separate database
- All client data stored here:
  - Shops
  - Users (admin, staff, customers)
  - Services
  - Bookings
  - Slots
  - Invoices
  - Settings
- **Complete isolation** - no cross-database access possible
- **No `tenantId` fields** needed (database provides isolation)

## Best Practices

1. **Client Admin Creation:**
   - Use professional email addresses
   - Set strong passwords (min 6 chars)
   - Provide complete information
   - Set appropriate maxShops and maxStaff limits

2. **Password Management:**
   - Use strong, unique passwords
   - Don't share passwords via insecure channels
   - Update passwords periodically
   - Super admin controls all passwords

3. **Payment Recording:**
   - Verify payment before recording
   - Use receipt numbers for tracking
   - Keep payment history for audit
   - Extend expiry appropriately

4. **Multi-Domain:**
   - Each client uses same API
   - Frontend can be customized per domain
   - Data isolation maintained automatically
   - Super admin manages all from one place

5. **Database Management:**
   - Databases are created automatically
   - No manual database creation needed
   - Each client database is independent
   - Backup strategies should account for multiple databases

## Error Handling

### Client Admin Already Exists
```json
{
  "success": false,
  "error": "Client admin with this email already exists"
}
```

### Database Creation Failed
```json
{
  "success": false,
  "error": "Failed to create client database"
}
```

### Missing Required Fields
```json
{
  "success": false,
  "error": "Email, phone, adminPassword, adminFirstName, and adminLastName are required"
}
```

### Subscription Expired
```json
{
  "success": false,
  "error": "Subscription has expired. Please contact support."
}
```

## Summary

1. **Super Admin** creates client admin → **System automatically creates database**
2. **Client Admin** receives credentials and logs in
3. **JWT token** includes `databaseName` for automatic routing
4. **Client Admin** deploys frontend on their own domain
5. **Super Admin** views all client admins, shops (via queries), and expiry dates
6. **Client Admin** pays subscription
7. **Super Admin** records payment and extends expiry
8. **System** automatically manages subscription status

All client data is completely isolated in separate databases, and each client admin can have their own domain while using the same backend API.
