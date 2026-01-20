/**
 * Model Factory
 * Dynamically creates Mongoose models per database to avoid global model collisions
 * Each database gets its own set of models
 */

const modelCache = new Map(); // Map<databaseName, Map<modelName, Model>>

/**
 * Get or create a model for a specific database
 * @param {string} databaseName - Name of the database
 * @param {string} modelName - Name of the model
 * @param {mongoose.Schema} schema - Mongoose schema for the model
 * @returns {mongoose.Model} Mongoose model
 */
async function getModel(databaseName, modelName, schema) {
  if (!databaseName || !modelName || !schema) {
    throw new Error('databaseName, modelName, and schema are required');
  }

  // Initialize database cache if needed
  if (!modelCache.has(databaseName)) {
    modelCache.set(databaseName, new Map());
  }

  const dbModels = modelCache.get(databaseName);

  // Return existing model if available
  if (dbModels.has(modelName)) {
    return dbModels.get(modelName);
  }

  // Create new model for this database
  const connectionManager = require('./connectionManager');
  
  // Get connection for this database (async - connection may need to be created)
  let connection;
  if (databaseName === 'platform_db') {
    connection = connectionManager.getPlatformDb();
  } else {
    // For client databases, get or create connection
    connection = await connectionManager.getDb(databaseName);
  }

  if (!connection) {
    throw new Error(`Connection to database ${databaseName} not found. Ensure database is connected first.`);
  }

  // Create model using the connection
  // Check if model already exists on connection
  if (connection.models[modelName]) {
    const Model = connection.models[modelName];
    dbModels.set(modelName, Model);
    return Model;
  }

  const Model = connection.model(modelName, schema);

  // Cache the model
  dbModels.set(modelName, Model);

  return Model;
}

/**
 * Clear models for a database (useful for testing)
 */
function clearModels(databaseName) {
  if (modelCache.has(databaseName)) {
    modelCache.delete(databaseName);
  }
}

/**
 * Clear all models
 */
function clearAllModels() {
  modelCache.clear();
}

/**
 * Get all models for a database
 */
function getDatabaseModels(databaseName) {
  return modelCache.get(databaseName) || new Map();
}

module.exports = {
  getModel,
  clearModels,
  clearAllModels,
  getDatabaseModels,
};
