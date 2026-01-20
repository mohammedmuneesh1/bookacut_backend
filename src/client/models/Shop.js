const mongoose = require('mongoose');

/**
 * Shop Model Schema
 * Stored in CLIENT DATABASE
 * Each client can have multiple shops
 * NO tenantId - database isolation provides tenant separation
 */
const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    workingHours: {
      monday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
      tuesday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
      wednesday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
      thursday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
      friday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
      saturday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
      sunday: { start: String, end: String, isOpen: { type: Boolean, default: false } },
    },
    slotDuration: {
      type: Number,
      default: 30, // minutes
      required: true,
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
shopSchema.index({ isActive: 1 });
shopSchema.index({ name: 1 });

module.exports = {
  schema: shopSchema,
};

