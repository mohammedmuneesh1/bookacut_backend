const mongoose = require('mongoose');
const connectionManager = require('../../database/connectionManager');

/**
 * Client Admin Schema
 * Stored in platform_db
 * Represents client admin users (shop owners)
 * Contains metadata only - actual user data is in client database
 */
const clientAdminSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
    },
    maxShops: {
      type: Number,
      default: 10,
    },
    maxStaff: {
      type: Number,
      default: 50,
    },
    subscriptionPlan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic',
    },
    subscriptionExpiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
clientAdminSchema.index({ email: 1 }, { unique: true });
clientAdminSchema.index({ databaseName: 1 }, { unique: true });
clientAdminSchema.index({ clientId: 1 }, { unique: true });
clientAdminSchema.index({ isActive: 1 });

/**
 * Get ClientAdmin model for platform_db
 */
function getClientAdminModel() {
  const connection = connectionManager.getPlatformDb();
  if (!connection.models.ClientAdmin) {
    return connection.model('ClientAdmin', clientAdminSchema);
  }
  return connection.models.ClientAdmin;
}

module.exports = {
  schema: clientAdminSchema,
  getModel: getClientAdminModel,
};

