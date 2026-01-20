const mongoose = require('mongoose');

/**
 * Staff Profile Model Schema
 * Stored in CLIENT DATABASE
 * Links staff users to shops and tracks shop-specific staff data
 * NO tenantId - database isolation provides tenant separation
 */
const staffProfileSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    specialization: [
      {
        type: String,
      },
    ],
    hourlyRate: {
      type: Number,
      default: 0,
    },
    commissionRate: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
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

// Compound indexes
staffProfileSchema.index({ shopId: 1 });
staffProfileSchema.index({ shopId: 1, isActive: 1 });
staffProfileSchema.index({ userId: 1, shopId: 1 }, { unique: true });

module.exports = {
  schema: staffProfileSchema,
};

