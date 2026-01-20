const mongoose = require('mongoose');

/**
 * Service Model Schema
 * Stored in CLIENT DATABASE
 * Services offered by shops (e.g., Haircut, Facial, etc.)
 * NO tenantId - database isolation provides tenant separation
 */
const serviceSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    description: {
      type: String,
    },
    category: {
      type: String,
      enum: ['haircut', 'hair_color', 'facial', 'massage', 'manicure', 'pedicure', 'other'],
      default: 'other',
    },
    duration: {
      type: Number,
      required: [true, 'Service duration is required'],
      default: 30, // minutes
    },
    price: {
      type: Number,
      required: [true, 'Service price is required'],
      min: 0,
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

// Compound indexes
serviceSchema.index({ shopId: 1 });
serviceSchema.index({ shopId: 1, isActive: 1 });
serviceSchema.index({ shopId: 1, category: 1 });

module.exports = {
  schema: serviceSchema,
};

