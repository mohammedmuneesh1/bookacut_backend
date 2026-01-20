const mongoose = require('mongoose');

/**
 * Database Connection Manager
 * Manages connections to multiple databases within a single MongoDB cluster
 * - platform_db: Platform super admin data
 * - client_*_db: Client-specific databases
 */

class ConnectionManager {
  constructor() {
    this.connections = new Map(); // Map<databaseName, connection>
    this.mainConnection = null;
    this.connectionString = null;
  }

  /**
   * Initialize main connection to MongoDB cluster
   * This connection is used to switch between databases
   */
  async initialize() {
    try {
      this.connectionString = process.env.MONGODB_URI;
      
      // Parse connection string to get base URI (without database name)
      const uriParts = this.connectionString.split('/');
      const baseUri = uriParts.slice(0, -1).join('/');
      const defaultDb = uriParts[uriParts.length - 1]?.split('?')[0] || 'platform_db';

      // Connect to platform_db by default
      const platformUri = `${baseUri}/platform_db${this.connectionString.includes('?') ? '?' + this.connectionString.split('?')[1] : ''}`;
      
      this.mainConnection = await mongoose.createConnection(platformUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      // Store platform_db connection
      this.connections.set('platform_db', this.mainConnection);

      console.log(`MongoDB Connection Manager initialized`);
      console.log(`Platform database connected: platform_db`);

      // Handle connection events
      this.mainConnection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });

      this.mainConnection.on('disconnected', () => {
        console.log('MongoDB disconnected');
      });

      return this.mainConnection;
    } catch (error) {
      console.error(`Error initializing database connection manager: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get connection to a specific database
   * Creates new connection if it doesn't exist
   */
  async getDb(databaseName) {
    if (!databaseName) {
      throw new Error('Database name is required');
    }

    // Return existing connection if available
    if (this.connections.has(databaseName)) {
      return this.connections.get(databaseName);
    }

    // Create new connection
    try {
      const uriParts = this.connectionString.split('/');
      const baseUri = uriParts.slice(0, -1).join('/');
      const queryParams = this.connectionString.includes('?') 
        ? '?' + this.connectionString.split('?')[1] 
        : '';

      const dbUri = `${baseUri}/${databaseName}${queryParams}`;

      const connection = await mongoose.createConnection(dbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      // Handle connection events
      connection.on('error', (err) => {
        console.error(`MongoDB connection error for ${databaseName}:`, err);
      });

      connection.on('disconnected', () => {
        console.log(`MongoDB disconnected for ${databaseName}`);
        this.connections.delete(databaseName);
      });

      // Store connection
      this.connections.set(databaseName, connection);

      console.log(`Connected to database: ${databaseName}`);
      return connection;
    } catch (error) {
      console.error(`Error connecting to database ${databaseName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get platform database connection
   */
  getPlatformDb() {
    return this.getDb('platform_db');
  }

  /**
   * Check if database exists
   */
  async databaseExists(databaseName) {
    try {
      const adminDb = this.mainConnection.db.admin();
      const { databases } = await adminDb.listDatabases();
      return databases.some(db => db.name === databaseName);
    } catch (error) {
      console.error(`Error checking if database exists: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a new database (client database)
   */
  async createDatabase(databaseName) {
    try {
      // Check if database already exists
      const exists = await this.databaseExists(databaseName);
      if (exists) {
        console.log(`Database ${databaseName} already exists`);
        return await this.getDb(databaseName);
      }

      // Create connection to new database
      // Database is created automatically on first write operation
      const connection = await this.getDb(databaseName);

      // Initialize database with default collections/indexes
      await this.initializeClientDatabase(connection);

      console.log(`Database ${databaseName} created successfully`);
      return connection;
    } catch (error) {
      console.error(`Error creating database ${databaseName}:`, error.message);
      throw error;
    }
  }

  /**
   * Initialize client database with base collections
   */
  async initializeClientDatabase(connection) {
    try {
      // Create base collections by inserting and deleting a document
      // This ensures collections exist and indexes can be created
      const db = connection.db;

      // Initialize collections with dummy documents that will be removed
      const collections = ['users', 'shops', 'services', 'slots', 'bookings', 'invoices', 'staffprofiles', 'shopsettings', 'offers', 'roles'];

      for (const collectionName of collections) {
        try {
          // Create collection by inserting a dummy document
          await db.collection(collectionName).insertOne({ _init: true });
          // Remove the dummy document
          await db.collection(collectionName).deleteOne({ _init: true });
        } catch (error) {
          // Collection might already exist, that's fine
          console.log(`Collection ${collectionName} initialization skipped: ${error.message}`);
        }
      }

      console.log(`Client database initialized with base collections`);
    } catch (error) {
      console.error(`Error initializing client database:`, error.message);
      throw error;
    }
  }

  /**
   * Close all connections
   */
  async closeAll() {
    try {
      const closePromises = Array.from(this.connections.values()).map(conn => conn.close());
      await Promise.all(closePromises);
      this.connections.clear();
      console.log('All database connections closed');
    } catch (error) {
      console.error(`Error closing connections:`, error.message);
      throw error;
    }
  }

  /**
   * Close specific database connection
   */
  async closeDatabase(databaseName) {
    try {
      if (this.connections.has(databaseName)) {
        const connection = this.connections.get(databaseName);
        await connection.close();
        this.connections.delete(databaseName);
        console.log(`Database connection closed: ${databaseName}`);
      }
    } catch (error) {
      console.error(`Error closing database ${databaseName}:`, error.message);
      throw error;
    }
  }
}

// Export singleton instance
const connectionManager = new ConnectionManager();

module.exports = connectionManager;

