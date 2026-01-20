const mongoose = require('mongoose');

/**
 * Role Model Schema
 * Stored in CLIENT DATABASE
 * Defines roles and their permissions for RBAC
 * NO tenantId - database isolation provides tenant separation
 */
const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      enum: ['client_admin', 'staff', 'customer'],
      unique: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          'manage_shops',
          'manage_staff',
          'manage_services',
          'view_dashboard',
          'manage_slots',
          'view_invoices',
          'manage_settings',
          'view_bookings',
          'create_walkin',
          'edit_price',
          'mark_arrived',
          'mark_no_show',
          'complete_service',
          'generate_invoice',
          'view_services',
          'view_slots',
          'book_slot',
          'view_booking_history',
          'cancel_booking',
        ],
      },
    ],
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    description: {
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

// Index for role name
roleSchema.index({ name: 1 }, { unique: true });

module.exports = {
  schema: roleSchema,
};

