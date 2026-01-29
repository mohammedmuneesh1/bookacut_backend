const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const ShopSettings = require('../models/ShopSettings');
const StaffProfile = require('../models/StaffProfile');
const { v4: uuidv4 } = require('uuid');
const { INVOICE_STATUS } = require('../config/constants');

/**
 * Invoice Service
 * Handles invoice generation and management
 */
class InvoiceService {
  /**
   * Generate invoice for completed booking
   */
  async generateInvoice(tenantId, shopId, bookingId) {
    try {
      // Check if invoice already exists
      const existingInvoice = await Invoice.findOne({ bookingId });

      if (existingInvoice) {
        return existingInvoice;
      }

      // Get booking details
      const booking = await Booking.findOne({
        _id: bookingId,
        tenantId,
        shopId,
        status: 'completed',
      })
        .populate('serviceId')
        .populate('customerId')
        .populate('staffId');

      if (!booking) {
        throw new Error('Completed booking not found');
      }

      // Get shop settings for tax
      const settings = await ShopSettings.findOne({ tenantId, shopId });
      const taxRate = settings?.taxRate || 0;

      // Calculate amounts
      const amount = booking.finalPrice;
      const discount = booking.originalPrice - booking.finalPrice;
      const tax = (amount * taxRate) / 100;
      const totalAmount = amount + tax;

      // Calculate commission if staff is assigned
      let commissionAmount = 0;
      let commissionRate = 0;
      let staffId = null;

      if (booking.staffId) {
        staffId = booking.staffId._id || booking.staffId;
        
        // Get staff profile to get commission rate
        const staffProfile = await StaffProfile.findOne({
          _id: staffId,
          tenantId,
          shopId,
          isActive: true,
        });

        if (staffProfile && staffProfile.commissionRate > 0) {
          commissionRate = staffProfile.commissionRate;
          // Commission is calculated on the amount (before tax)
          commissionAmount = (amount * commissionRate) / 100;
        }
      }

      // Generate invoice number
      const invoiceNumber = `INV-${tenantId.toString().slice(-6)}-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;

      // Create invoice
      const invoice = await Invoice.create({
        tenantId,
        shopId,
        bookingId,
        invoiceNumber,
        customerId: booking.customerId._id,
        serviceId: booking.serviceId._id,
        staffId,
        amount,
        tax,
        discount,
        totalAmount,
        commissionAmount,
        commissionRate,
        totalPaidAmount: 0,
        remainingBalance: amount + tax,
        status: INVOICE_STATUS.PENDING,
      });

      return invoice;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add payment to invoice (supports partial payments)
   */
  async addPayment(tenantId, shopId, invoiceId, paymentData) {
    try {
      const { amount, paymentMethod, paymentReference, notes, paidBy } = paymentData;

      if (!amount || amount <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }

      if (!paymentMethod) {
        throw new Error('Payment method is required');
      }

      // Get invoice
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        tenantId,
        shopId,
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'cancelled') {
        throw new Error('Cannot add payment to cancelled invoice');
      }

      // Check if payment amount exceeds remaining balance
      const remainingBalance = invoice.remainingBalance || invoice.totalAmount - (invoice.totalPaidAmount || 0);
      
      if (amount > remainingBalance) {
        throw new Error(`Payment amount (${amount}) exceeds remaining balance (${remainingBalance})`);
      }

      // Create payment record
      const payment = await Payment.create({
        tenantId,
        shopId,
        invoiceId,
        bookingId: invoice.bookingId,
        amount,
        paymentMethod,
        paymentReference,
        notes,
        paidBy,
      });

      // Update invoice
      const newTotalPaid = (invoice.totalPaidAmount || 0) + amount;
      const newRemainingBalance = invoice.totalAmount - newTotalPaid;

      invoice.totalPaidAmount = newTotalPaid;
      invoice.remainingBalance = newRemainingBalance;

      // Update status based on payment
      if (newRemainingBalance <= 0) {
        invoice.status = INVOICE_STATUS.PAID;
        invoice.fullyPaidAt = new Date();
        if (!invoice.paidAt) {
          invoice.paidAt = new Date();
        }
      } else {
        invoice.status = 'partial';
        if (!invoice.paidAt) {
          invoice.paidAt = new Date();
        }
      }

      // Keep paymentMethod for backward compatibility (use first payment method)
      if (!invoice.paymentMethod) {
        invoice.paymentMethod = paymentMethod;
      }

      await invoice.save();

      return {
        payment,
        invoice,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark invoice as paid (full payment - backward compatibility)
   */
  async markPaid(tenantId, shopId, invoiceId, paymentMethod) {
    try {
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        tenantId,
        shopId,
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Calculate remaining balance
      const remainingBalance = invoice.remainingBalance || invoice.totalAmount - (invoice.totalPaidAmount || 0);

      // Add full payment
      return await this.addPayment(tenantId, shopId, invoiceId, {
        amount: remainingBalance,
        paymentMethod,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment history for an invoice
   */
  async getInvoicePayments(tenantId, shopId, invoiceId) {
    try {
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        tenantId,
        shopId,
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const payments = await Payment.find({
        tenantId,
        shopId,
        invoiceId,
      })
        .populate('paidBy', 'firstName lastName email')
        .sort({ createdAt: -1 });

      return {
        invoice,
        payments,
        summary: {
          totalAmount: invoice.totalAmount,
          totalPaid: invoice.totalPaidAmount || 0,
          remainingBalance: invoice.remainingBalance || invoice.totalAmount - (invoice.totalPaidAmount || 0),
          paymentCount: payments.length,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get invoices for a shop
   */
  async getShopInvoices(tenantId, shopId, filters = {}) {
    try {
      const query = {
        tenantId,
        shopId,
      };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate),
        };
      }

      const invoices = await Invoice.find(query)
        .populate('customerId', 'firstName lastName phone email')
        .populate('serviceId', 'name')
        .populate('staffId', 'employeeId')
        .populate('bookingId', 'scheduledAt')
        .sort({ createdAt: -1 });

      // Get payment counts for each invoice
      const invoiceIds = invoices.map(inv => inv._id);
      const paymentCounts = await Payment.aggregate([
        {
          $match: {
            tenantId: tenantId,
            shopId: shopId,
            invoiceId: { $in: invoiceIds },
          },
        },
        {
          $group: {
            _id: '$invoiceId',
            paymentCount: { $sum: 1 },
          },
        },
      ]);

      const paymentCountMap = {};
      paymentCounts.forEach(pc => {
        paymentCountMap[pc._id.toString()] = pc.paymentCount;
      });

      // Add payment count to each invoice
      invoices.forEach(invoice => {
        invoice.paymentCount = paymentCountMap[invoice._id.toString()] || 0;
      });

      return invoices;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats(tenantId, shopId, startDate, endDate) {
    try {
      const invoices = await Invoice.find({
        tenantId,
        shopId,
        status: INVOICE_STATUS.PAID,
        paidAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });

      const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const totalTax = invoices.reduce((sum, inv) => sum + inv.tax, 0);
      const totalDiscount = invoices.reduce((sum, inv) => sum + inv.discount, 0);
      const totalInvoices = invoices.length;

      return {
        totalRevenue,
        totalTax,
        totalDiscount,
        totalInvoices,
        averageInvoiceValue: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get commission report for a staff member
   */
  async getStaffCommissionReport(tenantId, shopId, staffId, startDate, endDate) {
    try {
      const query = {
        tenantId,
        shopId,
        staffId,
        status: INVOICE_STATUS.PAID,
      };

      if (startDate && endDate) {
        query.paidAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const invoices = await Invoice.find(query)
        .populate('serviceId', 'name')
        .populate('customerId', 'firstName lastName')
        .sort({ paidAt: -1 });

      const totalCommission = invoices.reduce((sum, inv) => sum + inv.commissionAmount, 0);
      const totalSales = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const totalServices = invoices.length;

      return {
        staffId,
        period: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
        summary: {
          totalCommission,
          totalSales,
          totalServices,
          averageCommission: totalServices > 0 ? totalCommission / totalServices : 0,
        },
        invoices,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get commission report for all staff in a shop
   */
  async getShopCommissionReport(tenantId, shopId, startDate, endDate) {
    try {
      const query = {
        tenantId,
        shopId,
        status: INVOICE_STATUS.PAID,
        staffId: { $ne: null },
      };

      if (startDate && endDate) {
        query.paidAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const invoices = await Invoice.find(query)
        .populate('staffId', 'employeeId')
        .populate('serviceId', 'name')
        .populate('customerId', 'firstName lastName')
        .sort({ paidAt: -1 });

      // Group by staff
      const staffCommissions = {};
      
      invoices.forEach((invoice) => {
        const staffId = invoice.staffId._id.toString();
        if (!staffCommissions[staffId]) {
          staffCommissions[staffId] = {
            staffId: invoice.staffId._id,
            staffInfo: {
              employeeId: invoice.staffId.employeeId,
            },
            totalCommission: 0,
            totalSales: 0,
            totalServices: 0,
            invoices: [],
          };
        }
        
        staffCommissions[staffId].totalCommission += invoice.commissionAmount;
        staffCommissions[staffId].totalSales += invoice.totalAmount;
        staffCommissions[staffId].totalServices += 1;
        staffCommissions[staffId].invoices.push(invoice);
      });

      // Convert to array and calculate averages
      const staffList = Object.values(staffCommissions).map((staff) => ({
        ...staff,
        averageCommission: staff.totalServices > 0 ? staff.totalCommission / staff.totalServices : 0,
      }));

      const totalCommission = staffList.reduce((sum, staff) => sum + staff.totalCommission, 0);
      const totalSales = staffList.reduce((sum, staff) => sum + staff.totalSales, 0);
      const totalServices = staffList.reduce((sum, staff) => sum + staff.totalServices, 0);

      return {
        period: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
        summary: {
          totalCommission,
          totalSales,
          totalServices,
          totalStaff: staffList.length,
          averageCommission: totalServices > 0 ? totalCommission / totalServices : 0,
        },
        staffCommissions: staffList,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment method report for a shop
   */
  async getPaymentMethodReport(tenantId, shopId, startDate, endDate) {
    try {
      // Get all payments in the date range
      const paymentQuery = {
        tenantId,
        shopId,
      };

      if (startDate && endDate) {
        paymentQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const payments = await Payment.find(paymentQuery).sort({ createdAt: -1 });

      // Group by payment method
      const paymentMethodStats = {
        cash: { count: 0, totalAmount: 0, payments: [] },
        card: { count: 0, totalAmount: 0, payments: [] },
        upi: { count: 0, totalAmount: 0, payments: [] },
        online: { count: 0, totalAmount: 0, payments: [] },
        other: { count: 0, totalAmount: 0, payments: [] },
      };

      payments.forEach((payment) => {
        const method = payment.paymentMethod || 'other';
        if (paymentMethodStats[method]) {
          paymentMethodStats[method].count += 1;
          paymentMethodStats[method].totalAmount += payment.amount;
          paymentMethodStats[method].payments.push({
            paymentId: payment._id,
            amount: payment.amount,
            invoiceId: payment.invoiceId,
            createdAt: payment.createdAt,
            paymentReference: payment.paymentReference,
          });
        }
      });

      // Calculate totals
      const totalPayments = payments.length;
      const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

      // Convert to array format for easier consumption
      const paymentMethods = Object.keys(paymentMethodStats).map((method) => ({
        method,
        count: paymentMethodStats[method].count,
        totalAmount: paymentMethodStats[method].totalAmount,
        percentage: totalAmount > 0 ? (paymentMethodStats[method].totalAmount / totalAmount) * 100 : 0,
        payments: paymentMethodStats[method].payments,
      }));

      return {
        period: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
        summary: {
          totalPayments,
          totalAmount,
          paymentMethods,
        },
        details: paymentMethodStats,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get daily payment report for a shop
   */
  async getDailyPaymentReport(tenantId, shopId, startDate, endDate) {
    try {
      const paymentQuery = {
        tenantId,
        shopId,
      };

      if (startDate && endDate) {
        paymentQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const payments = await Payment.find(paymentQuery).sort({ createdAt: -1 });

      // Get invoice details for payments
      const invoiceIds = [...new Set(payments.map(p => {
        if (typeof p.invoiceId === 'object' && p.invoiceId._id) {
          return p.invoiceId._id;
        }
        return p.invoiceId;
      }).filter(Boolean))];
      
      const invoices = await Invoice.find({
        _id: { $in: invoiceIds },
        tenantId,
        shopId,
      })
        .populate('customerId', 'firstName lastName')
        .populate('serviceId', 'name')
        .populate('staffId', 'employeeId');

      const invoiceMap = {};
      invoices.forEach(inv => {
        invoiceMap[inv._id.toString()] = inv;
      });

      // Group by date and payment method
      const dailyStats = {};

      payments.forEach((payment) => {
        const dateKey = payment.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
        const method = payment.paymentMethod || 'other';
        const invoiceIdStr = typeof payment.invoiceId === 'object' && payment.invoiceId._id 
          ? payment.invoiceId._id.toString() 
          : payment.invoiceId.toString();
        const invoice = invoiceMap[invoiceIdStr];

        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = {
            date: dateKey,
            totalPayments: 0,
            totalAmount: 0,
            paymentMethods: {
              cash: { count: 0, amount: 0 },
              card: { count: 0, amount: 0 },
              upi: { count: 0, amount: 0 },
              online: { count: 0, amount: 0 },
              other: { count: 0, amount: 0 },
            },
            payments: [],
          };
        }

        dailyStats[dateKey].totalPayments += 1;
        dailyStats[dateKey].totalAmount += payment.amount;

        if (dailyStats[dateKey].paymentMethods[method]) {
          dailyStats[dateKey].paymentMethods[method].count += 1;
          dailyStats[dateKey].paymentMethods[method].amount += payment.amount;
        }

        dailyStats[dateKey].payments.push({
          paymentId: payment._id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentReference: payment.paymentReference,
          createdAt: payment.createdAt,
          invoice: invoice ? {
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: invoice.totalAmount,
            customer: invoice.customerId ? {
              name: `${invoice.customerId.firstName} ${invoice.customerId.lastName}`,
              id: invoice.customerId._id,
            } : null,
            service: invoice.serviceId ? {
              name: invoice.serviceId.name,
              id: invoice.serviceId._id,
            } : null,
            staff: invoice.staffId ? {
              employeeId: invoice.staffId.employeeId,
              id: invoice.staffId._id,
            } : null,
          } : null,
        });
      });

      // Convert to array and sort by date
      const dailyReports = Object.values(dailyStats).sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );

      return {
        period: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
        dailyReports,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new InvoiceService();

