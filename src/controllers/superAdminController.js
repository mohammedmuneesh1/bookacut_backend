const { getClientAdminModel } = require('../platform/models/ClientAdmin');
const { getClientDatabaseMapModel } = require('../platform/models/ClientDatabaseMap');
const connectionManager = require('../database/connectionManager');
const { getModel } = require('../database/modelFactory');
const shopSchema = require('../client/models/Shop').schema;
const clientDatabaseService = require('../services/clientDatabaseService');
const { NotFoundError, ValidationError } = require('../utils/errors');
const moment = require('moment');

/**
 * Super Admin Controller
 * Handles platform-level operations
 */
class SuperAdminController {
  /**
   * Get All Client Admins (Tenants) with Shop Counts
   */
  async getAllTenants(req, res, next) {
    try {
      const { page = 1, limit = 10, search, status } = req.query;
      const skip = (page - 1) * limit;

      // Build query
      const query = {};
      if (status) {
        query.isActive = status === 'active';
      }
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const ClientAdmin = getClientAdminModel();

      // Get client admins
      const clientAdmins = await ClientAdmin.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get shop counts and admin details for each client
      const clientsWithShopCounts = await Promise.all(
        clientAdmins.map(async (clientAdmin) => {
          // Get shop count from client database
          let shopCount = 0;
          let totalShops = 0;

          try {
            const clientDb = await connectionManager.getDb(clientAdmin.databaseName);
            const Shop = await getModel(clientAdmin.databaseName, 'Shop', shopSchema);

            shopCount = await Shop.countDocuments({ isActive: true });
            totalShops = await Shop.countDocuments({});
          } catch (error) {
            console.error(`Error getting shop count for ${clientAdmin.databaseName}:`, error.message);
          }

          // Check subscription status
          const isSubscriptionActive =
            clientAdmin.subscriptionExpiresAt && moment(clientAdmin.subscriptionExpiresAt).isAfter(moment());

          const daysUntilExpiry = clientAdmin.subscriptionExpiresAt
            ? moment(clientAdmin.subscriptionExpiresAt).diff(moment(), 'days')
            : null;

          const isExpired = clientAdmin.subscriptionExpiresAt
            ? moment(clientAdmin.subscriptionExpiresAt).isBefore(moment())
            : false;

          const isDemoPeriod = clientAdmin.subscriptionExpiresAt
            ? moment(clientAdmin.subscriptionExpiresAt).diff(moment(clientAdmin.createdAt), 'days') <= 3
            : false;

          return {
            ...clientAdmin.toObject(),
            shopCount,
            totalShops,
            isSubscriptionActive,
            isExpired,
            isDemoPeriod,
            daysUntilExpiry,
            subscriptionStartDate: clientAdmin.createdAt,
            subscriptionExpiryDate: clientAdmin.subscriptionExpiresAt,
          };
        })
      );

      const total = await ClientAdmin.countDocuments(query);

      res.json({
        success: true,
        tenants: clientsWithShopCounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Tenant Details with Full Statistics
   */
  async getTenantDetails(req, res, next) {
    try {
      const { tenantId } = req.params;

      const tenant = await Tenant.findById(tenantId);

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      // Get shop counts
      const activeShopCount = await Shop.countDocuments({
        tenantId: tenant._id,
        isActive: true,
      });

      const totalShopCount = await Shop.countDocuments({
        tenantId: tenant._id,
      });

      // Get payment history
      const payments = await SubscriptionPayment.find({ tenantId: tenant._id })
        .populate('recordedBy', 'firstName lastName email')
        .sort({ paymentDate: -1 })
        .limit(10);

      // Get subscription status
      const isSubscriptionActive =
        tenant.subscriptionExpiresAt && moment(tenant.subscriptionExpiresAt).isAfter(moment());

      const daysUntilExpiry = tenant.subscriptionExpiresAt
        ? moment(tenant.subscriptionExpiresAt).diff(moment(), 'days')
        : null;

      const isExpired = tenant.subscriptionExpiresAt
        ? moment(tenant.subscriptionExpiresAt).isBefore(moment())
        : false;

      const isDemoPeriod = tenant.subscriptionExpiresAt
        ? moment(tenant.subscriptionExpiresAt).diff(moment(tenant.createdAt), 'days') <= 3
        : false;

      // Get admin user
      const adminUser = await User.findOne({
        tenantId: tenant._id,
        role: 'client_admin',
      }).select('email firstName lastName phone lastLogin createdAt');

      res.json({
        success: true,
        tenant: {
          ...tenant.toObject(),
          activeShopCount,
          totalShopCount,
          isSubscriptionActive,
          isExpired,
          isDemoPeriod,
          daysUntilExpiry,
          subscriptionStartDate: tenant.createdAt,
          subscriptionExpiryDate: tenant.subscriptionExpiresAt,
          adminUser,
          recentPayments: payments,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record Subscription Payment and Update Expiry
   */
  async recordPayment(req, res, next) {
    try {
      const { tenantId } = req.params;
      const {
        amount,
        currency = 'USD',
        paymentMethod,
        subscriptionPeriod = 1,
        paymentDate,
        notes,
        receiptNumber,
      } = req.body;

      if (!amount || !paymentMethod) {
        throw new ValidationError('Amount and payment method are required');
      }

      // Get tenant
      const tenant = await Tenant.findById(tenantId);

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      // Calculate new expiry date
      const currentExpiry = tenant.subscriptionExpiresAt
        ? moment(tenant.subscriptionExpiresAt)
        : moment();
      const newExpiry = currentExpiry
        .clone()
        .add(subscriptionPeriod, 'months')
        .toDate();

      // Update tenant subscription
      tenant.subscriptionExpiresAt = newExpiry;
      tenant.subscriptionPlan = req.body.subscriptionPlan || tenant.subscriptionPlan;
      await tenant.save();

      // Record payment
      const payment = await SubscriptionPayment.create({
        tenantId: tenant._id,
        amount,
        currency,
        paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        subscriptionPeriod,
        subscriptionExpiresAt: newExpiry,
        recordedBy: req.user._id,
        notes,
        receiptNumber,
      });

      res.status(201).json({
        success: true,
        message: 'Payment recorded and subscription updated',
        payment,
        tenant: {
          ...tenant.toObject(),
          subscriptionExpiresAt: newExpiry,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Subscription Expiry Manually
   */
  async updateSubscriptionExpiry(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { subscriptionExpiresAt, subscriptionPlan, notes } = req.body;

      if (!subscriptionExpiresAt) {
        throw new ValidationError('Subscription expiry date is required');
      }

      const tenant = await Tenant.findById(tenantId);

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      tenant.subscriptionExpiresAt = new Date(subscriptionExpiresAt);
      if (subscriptionPlan) {
        tenant.subscriptionPlan = subscriptionPlan;
      }
      await tenant.save();

      // Optionally record as manual update
      if (notes) {
        await SubscriptionPayment.create({
          tenantId: tenant._id,
          amount: 0,
          currency: 'USD',
          paymentMethod: 'other',
          paymentDate: new Date(),
          subscriptionPeriod: 0,
          subscriptionExpiresAt: tenant.subscriptionExpiresAt,
          recordedBy: req.user._id,
          notes: `Manual update: ${notes}`,
        });
      }

      res.json({
        success: true,
        message: 'Subscription expiry updated',
        tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Payment History for a Tenant
   */
  async getPaymentHistory(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const payments = await SubscriptionPayment.find({ tenantId })
        .populate('recordedBy', 'firstName lastName email')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await SubscriptionPayment.countDocuments({ tenantId });

      res.json({
        success: true,
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Dashboard Statistics
   */
  async getDashboardStats(req, res, next) {
    try {
      const totalTenants = await Tenant.countDocuments();
      const activeTenants = await Tenant.countDocuments({
        isActive: true,
        subscriptionExpiresAt: { $gte: new Date() },
      });
      const expiredTenants = await Tenant.countDocuments({
        isActive: true,
        $or: [
          { subscriptionExpiresAt: { $lt: new Date() } },
          { subscriptionExpiresAt: null },
        ],
      });
      const totalShops = await Shop.countDocuments({ isActive: true });

      // Get tenants expiring soon (within 7 days)
      const expiringSoon = await Tenant.countDocuments({
        isActive: true,
        subscriptionExpiresAt: {
          $gte: moment().toDate(),
          $lte: moment().add(7, 'days').toDate(),
        },
      });

      // Get recent payments (last 30 days)
      const recentPayments = await SubscriptionPayment.find({
        paymentDate: {
          $gte: moment().subtract(30, 'days').toDate(),
        },
      });

      const totalRevenue = recentPayments.reduce((sum, p) => sum + p.amount, 0);

      res.json({
        success: true,
        stats: {
          totalTenants,
          activeTenants,
          expiredTenants,
          totalShops,
          expiringSoon,
          recentRevenue: totalRevenue,
          recentPaymentsCount: recentPayments.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create Client Admin (Tenant) with Database
   * Creates a new client database and initializes it with client admin user
   */
  async createTenant(req, res, next) {
    try {
      const {
        email,
        phone,
        subscriptionPlan,
        maxShops,
        maxStaff,
        adminPassword,
        adminFirstName,
        adminLastName,
        adminPhone,
      } = req.body;

      if (!email || !phone) {
        throw new ValidationError('Email and phone are required');
      }

      if (!adminPassword || !adminFirstName || !adminLastName) {
        throw new ValidationError('Client admin password, first name, and last name are required');
      }

      // Check if client admin already exists
      const ClientAdmin = getClientAdminModel();
      const existingClientAdmin = await ClientAdmin.findOne({ email: email.toLowerCase() });

      if (existingClientAdmin) {
        throw new ValidationError('Client admin with this email already exists');
      }

      // Set 3-day demo period
      const demoExpiry = moment().add(3, 'days').toDate();

      // Create client database and initialize
      const result = await clientDatabaseService.createClientDatabase({
        email,
        firstName: adminFirstName,
        lastName: adminLastName,
        phone: adminPhone || phone,
        password: adminPassword,
        maxShops: maxShops || 10,
        maxStaff: maxStaff || 50,
        subscriptionPlan: subscriptionPlan || 'basic',
        subscriptionExpiresAt: demoExpiry,
      });

      const { clientId, databaseName, clientAdmin } = result;

      res.status(201).json({
        success: true,
        message: 'Client admin and database created successfully with 3-day demo period',
        client: {
          clientId,
          databaseName,
          email: clientAdmin.email,
          firstName: clientAdmin.firstName,
          lastName: clientAdmin.lastName,
          phone: clientAdmin.phone,
          maxShops: clientAdmin.maxShops,
          maxStaff: clientAdmin.maxStaff,
          subscriptionPlan: clientAdmin.subscriptionPlan,
          subscriptionExpiresAt: demoExpiry,
          daysUntilExpiry: 3,
          isActive: clientAdmin.isActive,
          createdAt: clientAdmin.createdAt,
        },
        adminUser: {
          email: clientAdmin.email,
          firstName: clientAdmin.firstName,
          lastName: clientAdmin.lastName,
          phone: clientAdmin.phone,
        },
      });
    } catch (error) {
      next(error);
    }
  }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Tenant
   */
  async updateTenant(req, res, next) {
    try {
      const { tenantId } = req.params;
      const updates = req.body;

      const tenant = await Tenant.findById(tenantId);

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      Object.assign(tenant, updates);
      await tenant.save();

      res.json({
        success: true,
        tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create Client Admin User for Tenant
   */
  async createClientAdmin(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { email, password, firstName, lastName, phone } = req.body;

      if (!email || !password || !firstName || !lastName) {
        throw new ValidationError('Email, password, first name, and last name are required');
      }

      // Verify tenant exists
      const tenant = await Tenant.findById(tenantId);

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      const User = require('../models/User');
      const Role = require('../models/Role');
      const { ROLES, PERMISSIONS } = require('../config/constants');

      // Check if user already exists
      const existingUser = await User.findOne({ email, tenantId });

      if (existingUser) {
        throw new ValidationError('User with this email already exists for this tenant');
      }

      // Get or create client admin role
      let role = await Role.findOne({
        tenantId: tenant._id,
        name: ROLES.CLIENT_ADMIN,
      });

      if (!role) {
        role = await Role.create({
          tenantId: tenant._id,
          name: ROLES.CLIENT_ADMIN,
          permissions: [
            PERMISSIONS.MANAGE_SHOPS,
            PERMISSIONS.MANAGE_STAFF,
            PERMISSIONS.MANAGE_SERVICES,
            PERMISSIONS.VIEW_DASHBOARD,
            PERMISSIONS.MANAGE_SLOTS,
            PERMISSIONS.VIEW_INVOICES,
            PERMISSIONS.MANAGE_SETTINGS,
          ],
          isSystemRole: true,
        });
      }

      // Create client admin user
      const adminUser = await User.create({
        tenantId: tenant._id,
        email,
        password,
        phone: phone || tenant.phone,
        firstName,
        lastName,
        role: ROLES.CLIENT_ADMIN,
        roleId: role._id,
        isActive: true,
      });

      res.status(201).json({
        success: true,
        message: 'Client admin user created successfully',
        user: {
          id: adminUser._id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: adminUser.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Client Admin Password
   */
  async updateClientAdminPassword(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        throw new ValidationError('Password is required and must be at least 6 characters');
      }

      // Verify tenant exists
      const tenant = await Tenant.findById(tenantId);

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      const User = require('../models/User');
      const { ROLES } = require('../config/constants');

      // Find user and verify it's a client admin for this tenant
      const user = await User.findOne({
        _id: userId,
        tenantId: tenant._id,
        role: ROLES.CLIENT_ADMIN,
      });

      if (!user) {
        throw new NotFoundError('Client admin user');
      }

      // Update password (will be hashed by pre-save hook)
      user.password = password;
      await user.save();

      res.json({
        success: true,
        message: 'Client admin password updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SuperAdminController();

