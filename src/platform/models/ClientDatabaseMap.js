const mongoose = require('mongoose');
const connectionManager = require('../../database/connectionManager');

/**
 * Client Database Map Schema
 * Stored in platform_db
 * Maps clientId to database name for quick lookup
 */
const clientDatabaseMapSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: [true, 'Client ID is required'],
      unique: true,
      index: true,
    },
    databaseName: {
      type: String,
      required: [true, 'Database name is required'],
      unique: true,
      index: true,
    },
    clientAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClientAdmin',
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index
clientDatabaseMapSchema.index({ clientId: 1, databaseName: 1 });

/**
 * Get ClientDatabaseMap model for platform_db
 */
function getClientDatabaseMapModel() {
  const connection = connectionManager.getPlatformDb();
  if (!connection.models.ClientDatabaseMap) {
    return connection.model('ClientDatabaseMap', clientDatabaseMapSchema);
  }
  return connection.models.ClientDatabaseMap;
}

module.exports = {
  schema: clientDatabaseMapSchema,
  getModel: getClientDatabaseMapModel,
};

