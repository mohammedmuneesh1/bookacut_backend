const Booking = require('../models/Booking');
const StaffProfile = require('../models/StaffProfile');
const bookingService = require('../services/bookingService');
const invoiceService = require('../services/invoiceService');
const { NotFoundError } = require('../utils/errors');

/**
 * Staff Controller
 * Handles staff operations like viewing bookings, creating walk-ins, etc.
 */
class StaffController {
  /**
   * Get Shop Bookings
   */
  async getShopBookings(req, res, next) {
    try {
      const { shopId } = req.params;
      const { status, date, staffId } = req.query;
      const tenantId = req.tenantId;

      // Get staff profile to ensure access
      const staffProfile = await StaffProfile.findOne({
        userId: req.user._id,
        shopId,
        tenantId,
        isActive: true,
      });

      if (!staffProfile) {
        throw new NotFoundError('Staff profile');
      }

      const filters = {
        status,
        date: date ? new Date(date) : null,
        staffId: staffId || staffProfile._id,
      };

      const bookings = await bookingService.getShopBookings(tenantId, shopId, filters);

      res.json({
        success: true,
        bookings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create Walk-in Booking
   */
  async createWalkIn(req, res, next) {
    try {
      const { shopId } = req.params;
      const { slotId, serviceId, customerData, price } = req.body;
      const tenantId = req.tenantId;

      // Get staff profile
      const staffProfile = await StaffProfile.findOne({
        userId: req.user._id,
        shopId,
        tenantId,
        isActive: true,
      });

      if (!staffProfile) {
        throw new NotFoundError('Staff profile');
      }

      if (!slotId || !serviceId || !customerData) {
        throw new Error('Slot ID, service ID, and customer data are required');
      }

      const booking = await bookingService.createWalkInBooking(
        tenantId,
        shopId,
        slotId,
        serviceId,
        customerData,
        staffProfile._id,
        price
      );

      res.status(201).json({
        success: true,
        booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark Customer Arrived
   */
  async markArrived(req, res, next) {
    try {
      const { shopId, bookingId } = req.params;
      const tenantId = req.tenantId;

      const booking = await bookingService.markArrived(tenantId, shopId, bookingId);

      res.json({
        success: true,
        booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark No-Show
   */
  async markNoShow(req, res, next) {
    try {
      const { shopId, bookingId } = req.params;
      const tenantId = req.tenantId;

      const booking = await bookingService.markNoShow(tenantId, shopId, bookingId);

      res.json({
        success: true,
        booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Start Service
   */
  async startService(req, res, next) {
    try {
      const { shopId, bookingId } = req.params;
      const tenantId = req.tenantId;

      // Get staff profile
      const staffProfile = await StaffProfile.findOne({
        userId: req.user._id,
        shopId,
        tenantId,
        isActive: true,
      });

      if (!staffProfile) {
        throw new NotFoundError('Staff profile');
      }

      const booking = await bookingService.startService(
        tenantId,
        shopId,
        bookingId,
        staffProfile._id
      );

      res.json({
        success: true,
        booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete Service
   */
  async completeService(req, res, next) {
    try {
      const { shopId, bookingId } = req.params;
      const tenantId = req.tenantId;

      const booking = await bookingService.completeService(tenantId, shopId, bookingId);

      // Auto-generate invoice
      const invoice = await invoiceService.generateInvoice(tenantId, shopId, bookingId);

      res.json({
        success: true,
        booking,
        invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Edit Booking Price
   */
  async editPrice(req, res, next) {
    try {
      const { shopId, bookingId } = req.params;
      const { price, reason } = req.body;
      const tenantId = req.tenantId;

      if (!price) {
        throw new Error('Price is required');
      }

      const booking = await bookingService.editPrice(
        tenantId,
        shopId,
        bookingId,
        price,
        req.user._id,
        reason
      );

      res.json({
        success: true,
        booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate Invoice
   */
  async generateInvoice(req, res, next) {
    try {
      const { shopId, bookingId } = req.params;
      const tenantId = req.tenantId;

      const invoice = await invoiceService.generateInvoice(tenantId, shopId, bookingId);

      res.json({
        success: true,
        invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add Payment to Invoice (Supports Partial Payments)
   */
  async addPayment(req, res, next) {
    try {
      const { shopId, invoiceId } = req.params;
      const { amount, paymentMethod, paymentReference, notes } = req.body;
      const tenantId = req.tenantId;
      const paidBy = req.user._id;

      if (!amount || amount <= 0) {
        throw new Error('Payment amount is required and must be greater than 0');
      }

      if (!paymentMethod) {
        throw new Error('Payment method is required');
      }

      const result = await invoiceService.addPayment(tenantId, shopId, invoiceId, {
        amount,
        paymentMethod,
        paymentReference,
        notes,
        paidBy,
      });

      res.json({
        success: true,
        payment: result.payment,
        invoice: result.invoice,
        message: result.invoice.status === 'paid' 
          ? 'Invoice fully paid successfully' 
          : 'Partial payment added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark Invoice as Paid (Full Payment - Backward Compatibility)
   */
  async markInvoicePaid(req, res, next) {
    try {
      const { shopId, invoiceId } = req.params;
      const { paymentMethod } = req.body;
      const tenantId = req.tenantId;
      const paidBy = req.user._id;

      if (!paymentMethod) {
        throw new Error('Payment method is required');
      }

      const result = await invoiceService.markPaid(tenantId, shopId, invoiceId, paymentMethod);

      res.json({
        success: true,
        payment: result.payment,
        invoice: result.invoice,
        message: 'Invoice marked as paid successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Invoice Payment History
   */
  async getInvoicePayments(req, res, next) {
    try {
      const { shopId, invoiceId } = req.params;
      const tenantId = req.tenantId;

      const result = await invoiceService.getInvoicePayments(tenantId, shopId, invoiceId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StaffController();

