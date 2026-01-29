const Booking = require('../models/Booking');
const StaffProfile = require('../models/StaffProfile');
const Shop = require('../models/Shop');
const bookingService = require('../services/bookingService');
const invoiceService = require('../services/invoiceService');
const invoicePrinterService = require('../services/invoicePrinterService');
const emailService = require('../services/emailService');
const { NotFoundError } = require('../utils/errors');
const fs = require('fs');

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

  /**
   * Download Invoice PDF
   */
  async downloadInvoicePDF(req, res, next) {
    try {
      const { shopId, invoiceId } = req.params;
      const tenantId = req.tenantId;

      // Get invoice with populated data
      const invoice = await invoiceService.getInvoiceForPrinting(tenantId, shopId, invoiceId);
      
      // Get shop data
      const shop = await Shop.findOne({ _id: shopId, tenantId });
      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // Generate PDF
      const pdfPath = await invoicePrinterService.generatePDF(invoice, shop);

      // Send PDF as download
      res.download(pdfPath, `Invoice_${invoice.invoiceNumber}.pdf`, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
        }
        // Clean up file after sending (optional, or use cleanup job)
        // fs.unlinkSync(pdfPath);
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Print Invoice
   */
  async printInvoice(req, res, next) {
    try {
      const { shopId, invoiceId } = req.params;
      const { printerType, printerName, printerIP, port, deviceAddress } = req.body;
      const tenantId = req.tenantId;

      if (!printerType || !['usb', 'network', 'bluetooth'].includes(printerType.toLowerCase())) {
        throw new Error('Invalid printer type. Must be: usb, network, or bluetooth');
      }

      // Get invoice with populated data
      const invoice = await invoiceService.getInvoiceForPrinting(tenantId, shopId, invoiceId);
      
      // Get shop data
      const shop = await Shop.findOne({ _id: shopId, tenantId });
      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // Generate PDF
      const pdfPath = await invoicePrinterService.generatePDF(invoice, shop);

      let printResult;

      // Print based on type
      switch (printerType.toLowerCase()) {
        case 'usb':
          printResult = await invoicePrinterService.printToUSB(pdfPath, printerName);
          break;
        case 'network':
          if (!printerIP) {
            throw new Error('Printer IP address is required for network printing');
          }
          printResult = await invoicePrinterService.printToNetwork(pdfPath, printerIP, port, printerName);
          break;
        case 'bluetooth':
          if (!deviceAddress) {
            throw new Error('Bluetooth device address is required for Bluetooth printing');
          }
          printResult = await invoicePrinterService.printToBluetooth(pdfPath, deviceAddress, printerName);
          break;
        default:
          throw new Error('Invalid printer type');
      }

      res.json({
        success: true,
        message: 'Invoice sent to printer successfully',
        ...printResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send Invoice via Email
   */
  async sendInvoiceEmail(req, res, next) {
    try {
      const { shopId, invoiceId } = req.params;
      const { email } = req.body; // Optional: override customer email
      const tenantId = req.tenantId;

      // Get invoice with populated data
      const invoice = await invoiceService.getInvoiceForPrinting(tenantId, shopId, invoiceId);
      
      // Get shop data
      const shop = await Shop.findOne({ _id: shopId, tenantId });
      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // Determine recipient email
      const recipientEmail = email || invoice.customerId?.email;
      if (!recipientEmail) {
        throw new Error('Customer email address is required');
      }

      const customerName = invoice.customerId 
        ? `${invoice.customerId.firstName} ${invoice.customerId.lastName}`
        : 'Customer';

      // Generate PDF
      const pdfPath = await invoicePrinterService.generatePDF(invoice, shop);

      // Send email
      const emailResult = await emailService.sendInvoiceEmail({
        to: recipientEmail,
        customerName,
        invoiceNumber: invoice.invoiceNumber,
        pdfPath,
        invoiceData: invoice,
        shopData: shop,
      });

      res.json({
        success: true,
        message: 'Invoice email sent successfully',
        ...emailResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Available Printers
   */
  async getAvailablePrinters(req, res, next) {
    try {
      const printers = await invoicePrinterService.getAvailablePrinters();

      res.json({
        success: true,
        printers,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StaffController();

