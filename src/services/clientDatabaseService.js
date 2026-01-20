const connectionManager = require('../database/connectionManager');
const { getClientAdminModel } = require('../platform/models/ClientAdmin');
const { getClientDatabaseMapModel } = require('../platform/models/ClientDatabaseMap');
const { getModel } = require('../database/modelFactory');
const userSchema = require('../client/models/User').schema;
const roleSchema = require('../client/models/Role').schema;
const { ROLES, PERMISSIONS } = require('../config/constants');
const crypto = require('crypto');

/**
 * Client Database Service
 * Handles client database creation and initialization
 */
class ClientDatabaseService {
  /**
   * Generate unique database name
   */
  generateDatabaseName(clientId, email) {
    // Generate unique identifier
    const uniqueId = crypto.randomBytes(4).toString('hex');
    // Create database name: client_{uniqueId}_db
    return `client_${uniqueId}_db`;
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return crypto.randomBytes(12).toString('hex');
  }

  /**
   * Create client database and initialize with base data
   */
  async createClientDatabase(clientAdminData) {
    try {
      const { email, firstName, lastName, phone, password, maxShops, maxStaff, subscriptionPlan, subscriptionExpiresAt } = clientAdminData;

      // Generate unique client ID and database name
      const clientId = this.generateClientId();
      const databaseName = this.generateDatabaseName(clientId, email);

      // Create database
      const clientDb = await connectionManager.createDatabase(databaseName);

      // Initialize client database with default data
      await this.initializeClientDatabase(databaseName, {
        email,
        firstName,
        lastName,
        phone,
        password,
      });

      // Create ClientAdmin record in platform_db
      const ClientAdmin = getClientAdminModel();
      const clientAdmin = await ClientAdmin.create({
        clientId,
        databaseName,
        email: email.toLowerCase(),
        firstName,
        lastName,
        phone,
        maxShops: maxShops || 10,
        maxStaff: maxStaff || 50,
        subscriptionPlan: subscriptionPlan || 'basic',
        subscriptionExpiresAt,
        isActive: true,
      });

      // Create ClientDatabaseMap entry
      const ClientDatabaseMap = getClientDatabaseMapModel();
      await ClientDatabaseMap.create({
        clientId,
        databaseName,
        clientAdminId: clientAdmin._id,
      });

      return {
        clientId,
        databaseName,
        clientAdmin,
        db: clientDb,
      };
    } catch (error) {
      console.error('Error creating client database:', error);
      throw error;
    }
  }

  /**
   * Initialize client database with default roles and admin user
   */
  async initializeClientDatabase(databaseName, adminUserData) {
    try {
      const { email, firstName, lastName, phone, password } = adminUserData;

      // Get models for client database
      const User = await getModel(databaseName, 'User', userSchema);
      const Role = await getModel(databaseName, 'Role', roleSchema);

      // Create default roles
      const roles = [
        {
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
          description: 'Client admin with full access',
        },
        {
          name: ROLES.STAFF,
          permissions: [
            PERMISSIONS.VIEW_BOOKINGS,
            PERMISSIONS.CREATE_WALKIN,
            PERMISSIONS.EDIT_PRICE,
            PERMISSIONS.MARK_ARRIVED,
            PERMISSIONS.MARK_NO_SHOW,
            PERMISSIONS.COMPLETE_SERVICE,
            PERMISSIONS.GENERATE_INVOICE,
          ],
          isSystemRole: true,
          description: 'Staff member permissions',
        },
        {
          name: ROLES.CUSTOMER,
          permissions: [
            PERMISSIONS.VIEW_SERVICES,
            PERMISSIONS.VIEW_SLOTS,
            PERMISSIONS.BOOK_SLOT,
            PERMISSIONS.VIEW_BOOKING_HISTORY,
            PERMISSIONS.CANCEL_BOOKING,
          ],
          isSystemRole: true,
          description: 'Customer permissions',
        },
      ];

      // Create roles
      const createdRoles = await Promise.all(
        roles.map(async (roleData) => {
          let role = await Role.findOne({ name: roleData.name });
          if (!role) {
            role = await Role.create(roleData);
          }
          return role;
        })
      );

      // Find client admin role
      const clientAdminRole = createdRoles.find((r) => r.name === ROLES.CLIENT_ADMIN);

      // Create client admin user in client database
      const adminUser = await User.create({
        email: email.toLowerCase(),
        password,
        phone,
        firstName,
        lastName,
        role: ROLES.CLIENT_ADMIN,
        roleId: clientAdminRole._id,
        isActive: true,
      });

      console.log(`Client database initialized: ${databaseName}`);
      console.log(`Client admin user created: ${adminUser.email}`);

      return {
        roles: createdRoles,
        adminUser,
      };
    } catch (error) {
      console.error('Error initializing client database:', error);
      throw error;
    }
  }

  /**
   * Get client database by client ID
   */
  async getClientDatabase(clientId) {
    try {
      const ClientAdmin = getClientAdminModel();
      const clientAdmin = await ClientAdmin.findOne({ clientId, isActive: true });

      if (!clientAdmin) {
        throw new Error(`Client admin not found for clientId: ${clientId}`);
      }

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
}

module.exports = new ClientDatabaseService();

