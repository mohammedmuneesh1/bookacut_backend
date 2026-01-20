const mongoose = require('mongoose');

/**
 * Shop Settings Model Schema
 * Stored in CLIENT DATABASE
 * Shop-specific configuration and preferences
 * NO tenantId - database isolation provides tenant separation
 */
const shopSettingsSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      unique: true,
      index: true,
    },
    allowPriceEditing: {
      type: Boolean,
      default: true,
    },
    maxDiscountPercentage: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    autoConfirmBooking: {
      type: Boolean,
      default: true,
    },
    requireAdminApproval: {
      type: Boolean,
      default: false,
    },
    noShowTimeoutMinutes: {
      type: Number,
      default: 5,
      min: 1,
    },
    bookingAdvanceDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 30,
    },
    sendSmsNotifications: {
      type: Boolean,
      default: false,
    },
    sendEmailNotifications: {
      type: Boolean,
      default: true,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currency: {
      type: String,
      default: 'USD',
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

// Index
shopSettingsSchema.index({ shopId: 1 }, { unique: true });

module.exports = {
  schema: shopSettingsSchema,
};

