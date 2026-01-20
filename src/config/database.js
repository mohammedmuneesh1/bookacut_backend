const connectionManager = require('../database/connectionManager');

/**
 * MongoDB Connection Configuration
 * Initializes the database connection manager for multi-database support
 */
const connectDB = async () => {
  try {
    await connectionManager.initialize();
    console.log(`Database connection manager initialized`);
  } catch (error) {
    console.error(`Error initializing database connection manager: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

