const mongoose = require('mongoose');

/**
 * Offer Model Schema
 * Stored in CLIENT DATABASE
 * Promotional offers and discounts
 * NO tenantId - database isolation provides tenant separation
 */
const offerSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Offer title is required'],
    },
    description: {
      type: String,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    applicableServices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    maxUses: {
      type: Number,
    },
    usedCount: {
      type: Number,
      default: 0,
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
offerSchema.index({ shopId: 1 });
offerSchema.index({ shopId: 1, isActive: 1 });
offerSchema.index({ startDate: 1, endDate: 1 });

module.exports = {
  schema: offerSchema,
};

