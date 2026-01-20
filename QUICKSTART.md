# Quick Start Guide

## Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `MONGODB_URI` - Your MongoDB connection string (e.g., `mongodb://localhost:27017/bookacut`)
   - `JWT_SECRET` - A strong secret key (min 32 characters)
   - `PLATFORM_ADMIN_EMAIL` - Admin email (optional, default: `admin@bookacut.com`)
   - `PLATFORM_ADMIN_PASSWORD` - Admin password (optional, default: `ChangeThisPassword123!`)
   - `CREATE_SAMPLE_CLIENT` - Set to `true` to create sample client (optional)

3. **Start MongoDB**
   Ensure MongoDB is running on your system.

4. **Run Seed Script** (Optional but recommended)
   ```bash
   npm run seed
   ```
   This creates:
   - Platform super admin user in `platform_db`
   - Sample client admin and database (if `CREATE_SAMPLE_CLIENT=true`)

5. **Start Server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## Creating Your First Client Admin

### Step 1: Login as Platform Super Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bookacut.com",
    "password": "ChangeThisPassword123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@bookacut.com",
    "role": "platform_super_admin",
    "databaseName": "platform_db"
  }
}
```

### Step 2: Create Client Admin

This will automatically create:
- Client admin record in `platform_db`
- New client database (e.g., `client_64fa2c9e_db`)
- Client admin user in the client database
- Default roles in the client database

```bash
curl -X POST http://localhost:3000/api/super-admin/tenants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@myshop.com",
    "phone": "1234567890",
    "adminPassword": "SecurePassword123!",
    "adminFirstName": "John",
    "adminLastName": "Doe",
    "subscriptionPlan": "premium",
    "maxShops": 10
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Client admin and database created successfully with 3-day demo period",
  "client": {
    "clientId": "64fa2c9e...",
    "databaseName": "client_64fa2c9e_db",
    "email": "admin@myshop.com",
    "subscriptionExpiresAt": "2024-01-18T00:00:00.000Z",
    "daysUntilExpiry": 3
  },
  "adminUser": {
    "email": "admin@myshop.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Step 3: Login as Client Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@myshop.com",
    "password": "SecurePassword123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@myshop.com",
    "role": "client_admin",
    "databaseName": "client_64fa2c9e_db"
  }
}
```

**Note:** The JWT token includes `databaseName` for automatic database routing.

## Typical Workflow

1. **Create Shop**
   ```bash
   curl -X POST http://localhost:3000/api/admin/shops \
     -H "Authorization: Bearer CLIENT_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Main Street Salon",
       "phone": "555-1234",
       "address": {
         "street": "123 Main St",
         "city": "New York",
         "state": "NY",
         "zipCode": "10001"
       },
       "slotDuration": 30
     }'
   ```

2. **Add Staff**
   ```bash
   curl -X POST http://localhost:3000/api/admin/shops/SHOP_ID/staff \
     -H "Authorization: Bearer CLIENT_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "staff@myshop.com",
       "password": "StaffPass123!",
       "phone": "555-5678",
       "firstName": "Jane",
       "lastName": "Stylist"
     }'
   ```

3. **Create Service**
   ```bash
   curl -X POST http://localhost:3000/api/admin/shops/SHOP_ID/services \
     -H "Authorization: Bearer CLIENT_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Haircut",
       "description": "Standard haircut",
       "category": "haircut",
       "duration": 30,
       "price": 25
     }'
   ```

4. **Generate Slots**
   ```bash
   curl -X POST http://localhost:3000/api/admin/shops/SHOP_ID/slots/generate \
     -H "Authorization: Bearer CLIENT_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "startDate": "2024-01-01",
       "endDate": "2024-01-07"
     }'
   ```

5. **Register Customer**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "customer@example.com",
       "password": "CustomerPass123!",
       "phone": "555-9999",
       "firstName": "John",
       "lastName": "Customer",
       "databaseName": "client_64fa2c9e_db"
     }'
   ```

6. **Customer Books Slot**
   ```bash
   curl -X POST http://localhost:3000/api/customer/shops/SHOP_ID/bookings \
     -H "Authorization: Bearer CUSTOMER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "slotId": "SLOT_ID",
       "serviceId": "SERVICE_ID"
     }'
   ```

## Testing with Postman/Insomnia

Import these sample requests:

1. **Login (Platform Admin)** - POST `/api/auth/login`
2. **Create Client Admin** - POST `/api/super-admin/tenants`
3. **Login (Client Admin)** - POST `/api/auth/login`
4. **Create Shop** - POST `/api/admin/shops`
5. **Add Staff** - POST `/api/admin/shops/:shopId/staff`
6. **Create Service** - POST `/api/admin/shops/:shopId/services`
7. **Generate Slots** - POST `/api/admin/shops/:shopId/slots/generate`
8. **Register Customer** - POST `/api/auth/register` (requires `databaseName`)
9. **Get Available Slots** - GET `/api/customer/shops/:shopId/slots`
10. **Book Slot** - POST `/api/customer/shops/:shopId/bookings`

## Socket.IO Testing

```javascript
// In browser console or Node.js
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

// Join shop room (use databaseName from client admin login)
socket.emit('join-shop', {
  databaseName: 'client_64fa2c9e_db',
  shopId: 'YOUR_SHOP_ID'
});

socket.on('slot-updates', (data) => {
  console.log('Slots updated:', data);
});

socket.on('booking-updated', (data) => {
  console.log('Booking updated:', data);
});
```

## Common Issues

### MongoDB Connection Failed
- Check if MongoDB is running
- Verify `MONGODB_URI` in `.env`
- Check network connectivity

### JWT Token Invalid
- Verify `JWT_SECRET` is set
- Check token expiration
- Ensure token is sent in `Authorization: Bearer TOKEN` header

### Database Not Found
- Verify client admin exists in platform database
- Check that database was created during client admin creation
- Ensure `databaseName` is included in JWT token

### Client Admin Login Failed
- Verify client admin exists
- Check email and password
- Ensure client admin is active
- Verify subscription hasn't expired

### Customer Registration Failed
- Ensure `databaseName` is provided in request body
- Verify database name matches client admin's database
- Check if customer email already exists in that database

### Slot Generation Failed
- Ensure shop has active staff
- Check working hours configuration
- Verify shop is active

## Database Architecture Overview

### Platform Database (`platform_db`)
- Contains platform super admin users
- Contains client admin metadata
- Maps client IDs to database names
- No client data stored here

### Client Databases (`client_*_db`)
- Each client gets a unique database
- All client data (shops, users, bookings, etc.) stored here
- Complete isolation from other clients
- No `tenantId` fields needed (database provides isolation)

## Next Steps

1. Set up your frontend application
2. Configure shop settings
3. Add more services
4. Customize working hours
5. Record subscription payments (super admin)

For detailed API documentation, see `README.md`.
