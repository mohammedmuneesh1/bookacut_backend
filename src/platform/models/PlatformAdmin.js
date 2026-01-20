const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectionManager = require('../../database/connectionManager');
const { getModel } = require('../../database/modelFactory');

/**
 * Platform Admin Schema
 * Stored in platform_db
 * Represents platform super admin users
 */
const platformAdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Don't return password by default
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
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
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

// Hash password before saving
platformAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare password
platformAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes
platformAdminSchema.index({ email: 1 }, { unique: true });
platformAdminSchema.index({ isActive: 1 });

/**
 * Get PlatformAdmin model for platform_db
 */
function getPlatformAdminModel() {
  const connection = connectionManager.getPlatformDb();
  if (!connection.models.PlatformAdmin) {
    return connection.model('PlatformAdmin', platformAdminSchema);
  }
  return connection.models.PlatformAdmin;
}

module.exports = {
  schema: platformAdminSchema,
  getModel: getPlatformAdminModel,
};

