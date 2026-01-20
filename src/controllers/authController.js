const connectionManager = require('../database/connectionManager');
const { getPlatformAdminModel } = require('../platform/models/PlatformAdmin');
const { getClientAdminModel } = require('../platform/models/ClientAdmin');
const { getModel } = require('../database/modelFactory');
const userSchema = require('../client/models/User').schema;
const roleSchema = require('../client/models/Role').schema;
const jwt = require('jsonwebtoken');
const { AuthenticationError, ValidationError, NotFoundError } = require('../utils/errors');
const { ROLES, PERMISSIONS } = require('../config/constants');

/**
 * Auth Controller
 * Handles authentication and authorization for both platform and client databases
 */
class AuthController {
  /**
   * Generate JWT Token
   * Includes databaseName and role in token payload
   */
  generateToken(userId, role, databaseName = null) {
    const payload = {
      id: userId,
      role: role,
    };

    // Include databaseName for client users
    if (databaseName) {
      payload.databaseName = databaseName;
    }

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });
  }

  /**
   * Login
   * Supports both platform admin and client user login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      // Try platform admin login first
      const PlatformAdmin = getPlatformAdminModel();
      let platformAdmin = await PlatformAdmin.findOne({ email }).select('+password');

      if (platformAdmin) {
        // Verify password
        const isPasswordValid = await platformAdmin.comparePassword(password);

        if (!isPasswordValid) {
          throw new AuthenticationError('Invalid credentials');
        }

        if (!platformAdmin.isActive) {
          throw new AuthenticationError('Account is inactive');
        }

        // Update last login
        platformAdmin.lastLogin = new Date();
        await platformAdmin.save();

        // Generate token with platform admin role
        const token = this.generateToken(platformAdmin._id, 'platform_super_admin');

        res.json({
          success: true,
          token,
          user: {
            id: platformAdmin._id,
            email: platformAdmin.email,
            firstName: platformAdmin.firstName,
            lastName: platformAdmin.lastName,
            role: 'platform_super_admin',
            databaseName: 'platform_db',
            permissions: Object.values(PERMISSIONS), // Platform admin has all permissions
          },
        });
        return;
      }

      // Try client user login
      // First, find client admin record in platform_db to get databaseName
      const ClientAdmin = getClientAdminModel();
      const clientAdminRecord = await ClientAdmin.findOne({
        email: email.toLowerCase(),
        isActive: true,
      });

      if (!clientAdminRecord) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Get connection to client database
      const clientDb = await connectionManager.getDb(clientAdminRecord.databaseName);

      // Get User model from client database
      const User = await getModel(clientAdminRecord.databaseName, 'User', userSchema);

      // Find user in client database
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      if (!user.isActive) {
        throw new AuthenticationError('Account is inactive');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Get role permissions
      const Role = await getModel(clientAdminRecord.databaseName, 'Role', roleSchema);
      let role = null;
      if (user.roleId) {
        role = await Role.findById(user.roleId);
      } else {
        role = await Role.findOne({ name: user.role });
      }

      // Generate token with databaseName
      const token = this.generateToken(user._id, user.role, clientAdminRecord.databaseName);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          databaseName: clientAdminRecord.databaseName,
          permissions: role?.permissions || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register Customer (Online)
   * Registers a customer in a client database
   */
  async registerCustomer(req, res, next) {
    try {
      const { email, password, phone, firstName, lastName, databaseName } = req.body;

      if (!email || !password || !phone || !firstName || !lastName || !databaseName) {
        throw new ValidationError('All fields are required');
      }

      // Verify database exists
      const exists = await connectionManager.databaseExists(databaseName);
      if (!exists) {
        throw new NotFoundError('Client database');
      }

      // Get connection to client database
      const clientDb = await connectionManager.getDb(databaseName);

      // Get models from client database
      const User = await getModel(databaseName, 'User', userSchema);
      const Role = await getModel(databaseName, 'Role', roleSchema);

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });

      if (existingUser) {
        throw new ValidationError('User already exists');
      }

      // Get customer role
      let role = await Role.findOne({ name: ROLES.CUSTOMER });

      // Create customer role if doesn't exist
      if (!role) {
        role = await Role.create({
          name: ROLES.CUSTOMER,
          permissions: [
            PERMISSIONS.VIEW_SERVICES,
            PERMISSIONS.VIEW_SLOTS,
            PERMISSIONS.BOOK_SLOT,
            PERMISSIONS.VIEW_BOOKING_HISTORY,
            PERMISSIONS.CANCEL_BOOKING,
          ],
          isSystemRole: true,
        });
      }

      // Create user
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        phone,
        firstName,
        lastName,
        role: ROLES.CUSTOMER,
        roleId: role._id,
        bookingType: 'online',
        isActive: true,
      });

      // Generate token
      const token = this.generateToken(user._id, user.role, databaseName);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          databaseName: databaseName,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Current User
   * Returns current authenticated user
   */
  async getCurrentUser(req, res, next) {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      // If platform admin
      if (req.user.role === 'platform_super_admin') {
        const PlatformAdmin = getPlatformAdminModel();
        const user = await PlatformAdmin.findById(req.user._id).select('-password');

        if (!user) {
          throw new NotFoundError('User');
        }

        return res.json({
          success: true,
          user: {
            ...user.toObject(),
            role: 'platform_super_admin',
            databaseName: 'platform_db',
          },
        });
      }

      // Client user - get from client database
      const databaseName = req.user.databaseName;
      if (!databaseName) {
        throw new AuthenticationError('Database name not found');
      }

      const User = await getModel(databaseName, 'User', userSchema);
      const user = await User.findById(req.user._id).select('-password').populate('roleId');

      if (!user) {
        throw new NotFoundError('User');
      }

      res.json({
        success: true,
        user: {
          ...user.toObject(),
          role: user.role,
          databaseName: databaseName,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
