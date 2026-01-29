const mongoose = require('mongoose');

/**
 * Payment Model
 * Tracks individual payments made towards invoices (supports partial payments)
 */
const paymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
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
paymentSchema.index({ tenantId: 1, shopId: 1 });
paymentSchema.index({ tenantId: 1, shopId: 1, invoiceId: 1 });
paymentSchema.index({ tenantId: 1, shopId: 1, paymentMethod: 1 });
paymentSchema.index({ tenantId: 1, shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

