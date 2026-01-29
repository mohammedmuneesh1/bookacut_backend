const mongoose = require('mongoose');

/**
 * Payment Model Schema
 * Stored in CLIENT DATABASE
 * Tracks individual payments made towards invoices (supports partial payments)
 * NO tenantId - database isolation provides tenant separation
 */
const paymentSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Invoice ID is required'],
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0.01,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'online', 'other'],
      required: [true, 'Payment method is required'],
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
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
paymentSchema.index({ shopId: 1 });
paymentSchema.index({ shopId: 1, invoiceId: 1 });
paymentSchema.index({ shopId: 1, paymentMethod: 1 });
paymentSchema.index({ shopId: 1, createdAt: -1 });

module.exports = {
  schema: paymentSchema,
};

