const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticate } = require('../middlewares/auth');
const { validateTenant } = require('../middlewares/tenant');
const { requireRole, validateShopAccess } = require('../middlewares/rbac');
const { ROLES } = require('../config/constants');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validator');

/**
 * Staff Routes
 * All routes require staff role
 */

// Apply authentication and tenant validation to all routes
router.use(authenticate);
router.use(validateTenant);
router.use(requireRole(ROLES.STAFF));

// Bookings
router.get(
  '/shops/:shopId/bookings',
  validateShopAccess,
  staffController.getShopBookings.bind(staffController)
);

// Walk-in Booking
router.post(
  '/shops/:shopId/bookings/walkin',
  validateShopAccess,
  [
    body('slotId').notEmpty(),
    body('serviceId').notEmpty(),
    body('customerData.email').optional().isEmail(),
    body('customerData.phone').notEmpty(),
    body('customerData.firstName').notEmpty().trim(),
    body('customerData.lastName').notEmpty().trim(),
    validate,
  ],
  staffController.createWalkIn.bind(staffController)
);

// Booking Actions
router.post(
  '/shops/:shopId/bookings/:bookingId/arrived',
  validateShopAccess,
  staffController.markArrived.bind(staffController)
);

router.post(
  '/shops/:shopId/bookings/:bookingId/no-show',
  validateShopAccess,
  staffController.markNoShow.bind(staffController)
);

router.post(
  '/shops/:shopId/bookings/:bookingId/start',
  validateShopAccess,
  staffController.startService.bind(staffController)
);

router.post(
  '/shops/:shopId/bookings/:bookingId/complete',
  validateShopAccess,
  staffController.completeService.bind(staffController)
);

// Price Editing
router.put(
  '/shops/:shopId/bookings/:bookingId/price',
  validateShopAccess,
  [
    body('price').isFloat({ min: 0 }),
    validate,
  ],
  staffController.editPrice.bind(staffController)
);

// Invoice Management
router.post(
  '/shops/:shopId/bookings/:bookingId/invoice',
  validateShopAccess,
  staffController.generateInvoice.bind(staffController)
);

// Invoice Payment Management
router.post(
  '/shops/:shopId/invoices/:invoiceId/payments',
  validateShopAccess,
  [
    body('amount').isFloat({ min: 0.01 }),
    body('paymentMethod').isIn(['cash', 'card', 'upi', 'online', 'other']),
    body('paymentReference').optional().trim(),
    body('notes').optional().trim(),
    validate,
  ],
  staffController.addPayment.bind(staffController)
);

router.post(
  '/shops/:shopId/invoices/:invoiceId/paid',
  validateShopAccess,
  [
    body('paymentMethod').isIn(['cash', 'card', 'upi', 'online', 'other']),
    validate,
  ],
  staffController.markInvoicePaid.bind(staffController)
);

router.get(
  '/shops/:shopId/invoices/:invoiceId/payments',
  validateShopAccess,
  staffController.getInvoicePayments.bind(staffController)
);

module.exports = router;

