const jwt = require('jsonwebtoken');
const connectionManager = require('../database/connectionManager');
const { getPlatformAdminModel } = require('../platform/models/PlatformAdmin');
const { getClientAdminModel } = require('../platform/models/ClientAdmin');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Authentication Middleware
 * Validates JWT token and attaches user to request
 * Supports both platform admin (platform_db) and client users (client databases)
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's a platform admin
    if (decoded.role === 'platform_super_admin') {
      // Get user from platform_db
      const PlatformAdmin = getPlatformAdminModel();
      const user = await PlatformAdmin.findById(decoded.id).select('+password');

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      if (!user.isActive) {
        throw new AuthenticationError('User account is inactive');
      }

      // Attach user to request with role and database info
      req.user = user.toObject();
      req.user.role = 'platform_super_admin';
      req.user.databaseName = 'platform_db';
      req.user._id = user._id;

      return next();
    }

    // Client admin, staff, or customer - need database name from JWT
    if (!decoded.databaseName) {
      throw new AuthenticationError('Database name not found in token');
    }

    // Get connection to client database
    const clientDb = await connectionManager.getDb(decoded.databaseName);

    // Get User model from client database
    // Note: We need to dynamically load the User model
    const { getModel } = require('../database/modelFactory');
    const userSchema = require('../client/models/User').schema;
    const User = getModel(decoded.databaseName, 'User', userSchema);

    // Get user from client database
    const user = await User.findById(decoded.id).select('+password');

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('User account is inactive');
    }

    // Attach user to request
    req.user = user.toObject();
    req.user.role = decoded.role;
    req.user.databaseName = decoded.databaseName;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(error);
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if it's a platform admin
      if (decoded.role === 'platform_super_admin') {
        const PlatformAdmin = getPlatformAdminModel();
        const user = await PlatformAdmin.findById(decoded.id);

        if (user && user.isActive) {
          req.user = user.toObject();
          req.user.role = 'platform_super_admin';
          req.user.databaseName = 'platform_db';
          req.user._id = user._id;
        }
      } else if (decoded.databaseName) {
        // Client user
        const clientDb = await connectionManager.getDb(decoded.databaseName);
        const { getModel } = require('../database/modelFactory');
        const userSchema = require('../client/models/User').schema;
        const User = getModel(decoded.databaseName, 'User', userSchema);
        const user = await User.findById(decoded.id);

        if (user && user.isActive) {
          req.user = user.toObject();
          req.user.role = decoded.role;
          req.user.databaseName = decoded.databaseName;
        }
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};

