const mongoose = require('mongoose');

/**
 * Invoice Model Schema
 * Stored in CLIENT DATABASE
 * Auto-generated invoices for completed services
 * NO tenantId - database isolation provides tenant separation
 */
const invoiceSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      unique: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffProfile',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'cancelled', 'overpaid'],
      default: 'pending',
      index: true,
    },
    totalPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      min: 0,
    },
    paidAt: {
      type: Date,
    },
    fullyPaidAt: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'online', 'other'],
      index: true,
      // Deprecated: Use Payment model for multiple payment methods
    },
    notes: {
      type: String,
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
invoiceSchema.index({ shopId: 1 });
invoiceSchema.index({ shopId: 1, status: 1 });
invoiceSchema.index({ shopId: 1, createdAt: -1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ shopId: 1, staffId: 1 });
invoiceSchema.index({ shopId: 1, staffId: 1, status: 1 });
invoiceSchema.index({ shopId: 1, paymentMethod: 1 });
invoiceSchema.index({ shopId: 1, paymentMethod: 1, status: 1 });

module.exports = {
  schema: invoiceSchema,
};

