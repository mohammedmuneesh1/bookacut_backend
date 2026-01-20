const connectionManager = require('../database/connectionManager');
const { getClientAdminModel } = require('../platform/models/ClientAdmin');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Database Resolver Middleware
 * Determines which database to use based on user role and JWT payload
 * Must be used after authenticate middleware
 */
const resolveDatabase = async (req, res, next) => {
  try {
    // Platform super admin uses platform_db
    if (req.user && req.user.role === 'platform_super_admin') {
      req.db = await connectionManager.getPlatformDb();
      req.databaseName = 'platform_db';
      return next();
    }

    // Client admin, staff, and customers use client-specific database
    if (req.user && (req.user.role === 'client_admin' || req.user.role === 'staff' || req.user.role === 'customer')) {
      // Get database name from JWT or user object
      const databaseName = req.user.databaseName || req.user.dbName;

      if (!databaseName) {
        throw new AuthenticationError('Database name not found in user token');
      }

      // Get connection to client database
      req.db = await connectionManager.getDb(databaseName);
      req.databaseName = databaseName;

      return next();
    }

    // If no user but we have databaseName in request (for certain endpoints)
    if (req.body.databaseName || req.query.databaseName) {
      const databaseName = req.body.databaseName || req.query.databaseName;
      req.db = await connectionManager.getDb(databaseName);
      req.databaseName = databaseName;
      return next();
    }

    throw new AuthenticationError('Unable to resolve database for request');
  } catch (error) {
    next(error);
  }
};

/**
 * Get Client Database by Client ID
 * Helper function to get client database connection by clientId
 */
async function getClientDatabaseByClientId(clientId) {
  try {
    // Get ClientAdmin from platform_db
    const ClientAdmin = getClientAdminModel();
    const clientAdmin = await ClientAdmin.findOne({ clientId, isActive: true });

    if (!clientAdmin) {
      throw new Error(`Client admin not found for clientId: ${clientId}`);
    }

    // Get connection to client database
    const db = await connectionManager.getDb(clientAdmin.databaseName);
    return {
      db,
      databaseName: clientAdmin.databaseName,
      clientAdmin,
    };
  } catch (error) {
    throw new Error(`Error getting client database: ${error.message}`);
  }
}

module.exports = {
  resolveDatabase,
  getClientDatabaseByClientId,
};

