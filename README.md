# BookACut - Multi-Tenant SaaS Backend

A production-ready, multi-tenant SaaS backend for Beauty Parlour & Barber Shop Management Software built with Node.js, Express.js, and MongoDB.

## 🏗️ Architecture

### Database-Per-Tenant Architecture
- **Single MongoDB cluster** with **multiple databases** for true data isolation
- **Platform Database (`platform_db`)**: Stores platform super admin and client admin metadata
- **Client Databases**: Each client gets a unique database (e.g., `client_64fa2c9e_db`)
- **Database Isolation**: Complete data separation - no tenantId filtering needed
- **Multi-shop support**: One client (shop owner) can manage multiple shops within their database
- **Independent operations**: Each shop has independent staff, slots, bookings, and invoices

### Key Features
- ✅ True multi-database SaaS architecture
- ✅ Database-per-tenant with automatic database creation
- ✅ Complete data isolation per client
- ✅ Multi-shop management per client
- ✅ Dynamic slot generation based on staff count
- ✅ Real-time slot updates via Socket.IO
- ✅ Auto no-show handling via cron jobs
- ✅ Role-based access control (RBAC)
- ✅ JWT authentication with database context
- ✅ Online and walk-in booking support
- ✅ Price editing with audit trail
- ✅ Automatic invoice generation
- ✅ Comprehensive API endpoints

## 📋 Prerequisites

- Node.js (LTS version - 18.x or higher)
- MongoDB (4.4 or higher)
- npm or yarn

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bookacut_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/bookacut
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRE=7d
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run seed script** (Creates platform super admin)
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

7. **Verify installation**
   ```bash
   curl http://localhost:3000/health
   ```

## 📁 Project Structure

```
src/
 ├── database/         # Database connection management
 │   ├── connectionManager.js  # Multi-database connection manager
 │   └── modelFactory.js       # Dynamic model loader per database
 ├── platform/         # Platform database models
 │   └── models/
 │       ├── PlatformAdmin.js      # Platform super admin users
 │       ├── ClientAdmin.js        # Client admin metadata
 │       └── ClientDatabaseMap.js  # Client ID to database mapping
 ├── client/           # Client database models
 │   └── models/
 │       ├── User.js          # Client users (admin, staff, customers)
 │       ├── Shop.js          # Shops
 │       ├── Service.js       # Services
 │       ├── Booking.js       # Bookings
 │       ├── Slot.js          # Time slots
 │       ├── Invoice.js       # Invoices
 │       ├── StaffProfile.js  # Staff profiles
 │       ├── ShopSettings.js  # Shop settings
 │       ├── Role.js          # RBAC roles
 │       └── Offer.js         # Promotional offers
 ├── config/          # Configuration files
 │   ├── database.js
 │   └── constants.js
 ├── controllers/    # Request handlers
 │   ├── authController.js
 │   ├── superAdminController.js
 │   ├── clientAdminController.js
 │   ├── staffController.js
 │   └── customerController.js
 ├── middlewares/     # Express middlewares
 │   ├── auth.js              # JWT authentication
 │   ├── dbResolver.middleware.js  # Database resolution
 │   ├── rbac.js
 │   ├── errorHandler.js
 │   └── validator.js
 ├── services/        # Business logic
 │   ├── clientDatabaseService.js  # Client database creation
 │   ├── slotService.js
 │   ├── bookingService.js
 │   ├── invoiceService.js
 │   └── cronService.js
 ├── routes/          # API routes
 │   ├── authRoutes.js
 │   ├── superAdminRoutes.js
 │   ├── clientAdminRoutes.js
 │   ├── staffRoutes.js
 │   ├── customerRoutes.js
 │   └── index.js
 ├── sockets/         # Socket.IO handlers
 │   └── slotSocket.js
 ├── cron/            # Scheduled jobs
 │   └── jobs.js
 ├── utils/           # Utility functions
 │   ├── logger.js
 │   ├── errors.js
 │   └── seed.js
 ├── app.js           # Express app configuration
 └── server.js        # Server entry point
```

## 🔐 User Roles & Permissions

### 1. Platform Super Admin
- Stored in `platform_db`
- Full system access
- Can create client admins (which auto-creates databases)
- Manages all client subscriptions
- Never accesses client data directly

### 2. Client Admin (Shop Owner)
- Stored in their client database
- Created when client admin is created
- Can create and manage shops
- Add/manage staff per shop
- Configure shop settings
- View shop-wise dashboards
- Block/unblock slots
- Manage services
- View invoices and revenue

### 3. Staff
- Stored in client database
- View shop bookings
- Create walk-in customers
- Assign slots
- Edit booking price (if allowed)
- Mark arrived/no-show
- Complete services
- Generate invoices

### 4. Customer (Online)
- Stored in client database
- View services
- View available slots
- Book slots (up to 7 days ahead)
- View booking history
- Cancel bookings

### 5. Walk-in Customer
- Created by staff
- No authentication required
- High priority booking

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login (platform admin or client users)
- `POST /api/auth/register` - Register customer (requires databaseName)
- `GET /api/auth/me` - Get current user

### Super Admin APIs (Platform Management)
- `GET /api/super-admin/dashboard` - Get platform dashboard stats
- `GET /api/super-admin/tenants` - Get all client admins with shop counts
- `GET /api/super-admin/tenants/:clientId` - Get client admin details
- `POST /api/super-admin/tenants` - Create client admin (auto-creates database)
- `PUT /api/super-admin/tenants/:clientId` - Update client admin
- `POST /api/super-admin/tenants/:clientId/payments` - Record subscription payment
- `PUT /api/super-admin/tenants/:clientId/subscription` - Update subscription expiry
- `GET /api/super-admin/tenants/:clientId/payments` - Get payment history

### Client Admin APIs
- `POST /api/admin/shops` - Create shop
- `GET /api/admin/shops` - Get all shops
- `GET /api/admin/shops/:shopId` - Get shop details
- `PUT /api/admin/shops/:shopId` - Update shop
- `POST /api/admin/shops/:shopId/staff` - Add staff (with username/password)
- `GET /api/admin/shops/:shopId/staff` - Get shop staff
- `DELETE /api/admin/shops/:shopId/staff/:staffId` - Remove staff
- `PUT /api/admin/shops/:shopId/staff/:staffId/password` - Update staff password
- `PUT /api/admin/shops/:shopId/staff/:staffId/credentials` - Update staff credentials
- `POST /api/admin/shops/:shopId/services` - Create service
- `GET /api/admin/shops/:shopId/services` - Get shop services
- `PUT /api/admin/shops/:shopId/settings` - Update shop settings
- `POST /api/admin/shops/:shopId/slots/generate` - Generate slots
- `POST /api/admin/shops/:shopId/slots/:slotId/block` - Block slot
- `POST /api/admin/shops/:shopId/slots/:slotId/unblock` - Unblock slot
- `PUT /api/admin/shops/:shopId/slots/:slotId/capacity` - Reduce slot capacity
- `GET /api/admin/shops/:shopId/dashboard` - Get dashboard stats
- `GET /api/admin/shops/:shopId/invoices` - Get shop invoices

### Staff APIs
- `GET /api/staff/shops/:shopId/bookings` - Get shop bookings
- `POST /api/staff/shops/:shopId/bookings/walkin` - Create walk-in booking
- `POST /api/staff/shops/:shopId/bookings/:bookingId/arrived` - Mark arrived
- `POST /api/staff/shops/:shopId/bookings/:bookingId/no-show` - Mark no-show
- `POST /api/staff/shops/:shopId/bookings/:bookingId/start` - Start service
- `POST /api/staff/shops/:shopId/bookings/:bookingId/complete` - Complete service
- `PUT /api/staff/shops/:shopId/bookings/:bookingId/price` - Edit price
- `POST /api/staff/shops/:shopId/bookings/:bookingId/invoice` - Generate invoice
- `POST /api/staff/shops/:shopId/invoices/:invoiceId/paid` - Mark invoice paid

### Customer APIs
- `GET /api/customer/shops/:shopId` - Get shop details
- `GET /api/customer/shops/:shopId/services` - Get shop services
- `GET /api/customer/shops/:shopId/slots` - Get available slots
- `POST /api/customer/shops/:shopId/bookings` - Book slot
- `GET /api/customer/bookings` - Get booking history
- `POST /api/customer/shops/:shopId/bookings/:bookingId/cancel` - Cancel booking

## 🔄 Booking Flow

1. **Online Booking**
   - Customer views available slots
   - Selects slot and service
   - Booking auto-confirmed (if enabled)
   - Customer must arrive within 5 minutes

2. **Walk-in Booking**
   - Staff creates walk-in customer
   - Assigns slot and service
   - Can edit price
   - High priority booking

3. **Service Completion**
   - Staff marks customer arrived
   - Starts service
   - Completes service
   - Invoice auto-generated

4. **No-Show Handling**
   - Auto-detected after 5 minutes
   - Slot capacity freed
   - Walk-in can replace no-show

## ⚙️ Slot Engine

### Dynamic Slot Generation
- Slots generated per shop per day
- Capacity = number of active staff
- Example: 2 staff = capacity of 2 bookings per slot

### Slot Management
- Admin can block any slot
- Admin can reduce capacity manually
- Capacity auto-updates when staff changes
- Real-time updates via Socket.IO

## 🔔 Real-time Updates (Socket.IO)

### Client Connection
```javascript
const socket = io('http://localhost:3000');

// Join shop room
socket.emit('join-shop', {
  databaseName: 'client_64fa2c9e_db',
  shopId: '...'
});

// Listen for slot updates
socket.on('slot-updates', (data) => {
  console.log('Slots updated:', data.slots);
});

// Listen for booking updates
socket.on('booking-updated', (data) => {
  console.log('Booking updated:', data.booking);
});
```

## ⏰ Cron Jobs

1. **No-Show Handler** (Every minute)
   - Checks for bookings past scheduled time + timeout
   - Marks as no-show automatically

2. **Slot Generation** (Daily at 2 AM)
   - Generates slots for upcoming booking advance period

3. **Slot Capacity Update** (Every hour)
   - Updates slot capacities based on current staff count

## 🔒 Security Features

- JWT authentication with database context
- Password hashing with bcrypt
- Complete database isolation per client
- Role-based access control (RBAC)
- Input validation with express-validator
- Rate limiting
- Helmet.js for security headers
- CORS configuration

## 📊 Database Architecture

### Platform Database (`platform_db`)
- **PlatformAdmin**: Platform super admin users
- **ClientAdmin**: Client admin metadata and subscription info
- **ClientDatabaseMap**: Mapping of clientId to databaseName

### Client Databases (`client_*_db`)
Each client database contains:
- **User**: All users (admin, staff, customers) - NO tenantId field
- **Shop**: Shop locations - NO tenantId field
- **Service**: Services offered - NO tenantId field
- **Booking**: Customer bookings - NO tenantId field
- **Slot**: Time slots - NO tenantId field
- **Invoice**: Generated invoices - NO tenantId field
- **StaffProfile**: Staff-shop relationships - NO tenantId field
- **ShopSettings**: Shop configuration - NO tenantId field
- **Role**: RBAC roles - NO tenantId field
- **Offer**: Promotional offers - NO tenantId field

**Note:** All client models removed `tenantId` field because database isolation provides complete separation.

## 💳 Subscription Management

### Features
- **Monthly Subscription**: Client admins pay monthly subscription fees
- **Manual Payment Recording**: Super admin records payments when received
- **Automatic Expiry Extension**: Expiry date extends based on payment period
- **Subscription Validation**: Middleware checks subscription status before operations
- **Payment History**: Track all subscription payments with receipts
- **Expiry Notifications**: Cron job checks for expiring subscriptions

### Super Admin Workflow
1. View all client admins with shop counts and subscription status
2. When client admin makes payment, record it via API
3. System automatically extends subscription expiry date
4. View payment history for each client
5. Manually update expiry if needed

## ⏱️ Service Time Tracking

### Features
- **Start Time**: Recorded when service starts (`startedAt`)
- **Finish Time**: Recorded when service completes (`finishedAt`)
- **Duration Calculation**: Can calculate actual service duration
- **Performance Metrics**: Track service completion times

### Booking Time Fields
- `scheduledAt`: Original scheduled time
- `arrivedAt`: Customer arrival time
- `startedAt`: Service start time
- `completedAt`: Service completion time
- `finishedAt`: Service finish time

## 🧪 Testing the API

### 1. Login as Platform Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bookacut.com",
    "password": "ChangeThisPassword123!"
  }'
```

### 2. Create Client Admin (Auto-creates database)
```bash
curl -X POST http://localhost:3000/api/super-admin/tenants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@abcsalon.com",
    "phone": "1234567890",
    "adminPassword": "SecurePassword123!",
    "adminFirstName": "John",
    "adminLastName": "Doe",
    "subscriptionPlan": "premium",
    "maxShops": 10
  }'
```

### 3. Login as Client Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@abcsalon.com",
    "password": "SecurePassword123!"
  }'
```

### 4. Register Customer
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "password123",
    "phone": "1234567890",
    "firstName": "Jane",
    "lastName": "Doe",
    "databaseName": "client_64fa2c9e_db"
  }'
```

## 🛠️ Development

### Environment Variables
See `.env.example` for all available configuration options.

### Code Style
- Follow ES6+ JavaScript conventions
- Use async/await for asynchronous operations
- Proper error handling throughout
- Comprehensive comments

### Adding New Features
1. Create model in appropriate location (`platform/models/` or `client/models/`)
2. Create service in `src/services/`
3. Create controller in `src/controllers/`
4. Add routes in `src/routes/`
5. Update middleware if needed

## 📝 Notes

- **Client Admin Creation:** Platform super admin creates client admins, which automatically creates a new database
- **Database Isolation:** Each client database is completely isolated - no cross-database queries
- **Multi-Domain:** Each client admin can deploy frontend on their own domain
- **Demo Period:** New client admins get 3-day demo period automatically
- **JWT Context:** JWT tokens include `databaseName` for client users to route requests correctly
- **Slot capacity** dynamically adjusts based on active staff count
- **Bookings** can be made up to 7 days in advance (configurable)
- **No-show timeout** is 5 minutes (configurable per shop)
- **Price editing** can be enabled/disabled per shop
- **Maximum discount percentage** can be configured per shop
- **Subscription expiry** is checked before allowing client operations
- **Service start and finish times** are tracked for performance metrics
- **No payment gateway integration** - payments are recorded manually by super admin
- **Super admin can view** all client admin details, shops (via queries), and expiry dates

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify network connectivity

### JWT Token Issues
- Check `JWT_SECRET` is set
- Verify token expiration time
- Ensure token is sent in Authorization header

### Database Not Found
- Verify client admin exists in platform database
- Check database name in JWT token
- Ensure database was created during client admin creation

### Slot Generation Issues
- Verify shop has active staff
- Check working hours configuration
- Ensure shop is active

## 📄 License

ISC

## 👥 Support

For issues and questions, please contact the development team.

---

**Built with ❤️ for Beauty Parlour & Barber Shop Management**
