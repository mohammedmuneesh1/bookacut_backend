const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/**
 * Email Service
 * Handles sending emails including invoice emails to customers
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      // Get email configuration from environment variables
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      };

      // Only initialize if credentials are provided
      if (emailConfig.auth.user && emailConfig.auth.pass) {
        this.transporter = nodemailer.createTransport({
          host: emailConfig.host,
          port: emailConfig.port,
          secure: emailConfig.secure,
          auth: emailConfig.auth,
        });

        // Verify connection
        this.transporter.verify((error, success) => {
          if (error) {
            console.error('Email service configuration error:', error);
          } else {
            console.log('Email service is ready to send messages');
          }
        });
      } else {
        console.warn('Email service not configured. SMTP credentials missing.');
      }
    } catch (error) {
      console.error('Error initializing email service:', error);
    }
  }

  /**
   * Send invoice email to customer
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.customerName - Customer name
   * @param {string} options.invoiceNumber - Invoice number
   * @param {string} options.pdfPath - Path to PDF file
   * @param {Object} options.invoiceData - Invoice data
   * @param {Object} options.shopData - Shop data
   * @returns {Promise<Object>} Email send result
   */
  async sendInvoiceEmail(options) {
    const { to, customerName, invoiceNumber, pdfPath, invoiceData, shopData } = options;

    if (!this.transporter) {
      throw new Error('Email service is not configured. Please set SMTP credentials in environment variables.');
    }

    if (!to) {
      throw new Error('Recipient email address is required');
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file not found');
    }

    try {
      const shopName = shopData?.name || 'BookACut';
      const invoiceDate = new Date(invoiceData.createdAt).toLocaleDateString();
      const totalAmount = invoiceData.totalAmount.toFixed(2);

      const mailOptions = {
        from: `"${shopName}" <${process.env.SMTP_USER}>`,
        to: to,
        subject: `Invoice ${invoiceNumber} - ${shopName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background-color: #4CAF50;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
              }
              .content {
                background-color: #f9f9f9;
                padding: 20px;
                border-radius: 0 0 5px 5px;
              }
              .invoice-details {
                background-color: white;
                padding: 15px;
                margin: 20px 0;
                border-radius: 5px;
                border-left: 4px solid #4CAF50;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 12px;
              }
              .button {
                display: inline-block;
                padding: 10px 20px;
                background-color: #4CAF50;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 10px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${shopName}</h1>
                <p>Invoice Notification</p>
              </div>
              <div class="content">
                <p>Dear ${customerName},</p>
                <p>Thank you for your business! Please find your invoice attached.</p>
                
                <div class="invoice-details">
                  <h3>Invoice Details</h3>
                  <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                  <p><strong>Date:</strong> ${invoiceDate}</p>
                  <p><strong>Total Amount:</strong> $${totalAmount}</p>
                  <p><strong>Status:</strong> ${invoiceData.status.toUpperCase()}</p>
                </div>

                <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
                
                ${shopData?.phone ? `<p><strong>Phone:</strong> ${shopData.phone}</p>` : ''}
                ${shopData?.email ? `<p><strong>Email:</strong> ${shopData.email}</p>` : ''}
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} ${shopName}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        attachments: [
          {
            filename: `Invoice_${invoiceNumber}.pdf`,
            path: pdfPath,
            contentType: 'application/pdf',
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        message: 'Invoice email sent successfully',
        messageId: info.messageId,
        recipient: to,
      };
    } catch (error) {
      throw new Error(`Failed to send invoice email: ${error.message}`);
    }
  }

  /**
   * Send generic email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content (optional)
   * @param {Array} options.attachments - Array of attachment objects (optional)
   * @returns {Promise<Object>} Email send result
   */
  async sendEmail(options) {
    const { to, subject, html, text, attachments } = options;

    if (!this.transporter) {
      throw new Error('Email service is not configured. Please set SMTP credentials in environment variables.');
    }

    if (!to || !subject || (!html && !text)) {
      throw new Error('Email requires: to, subject, and html/text content');
    }

    try {
      const mailOptions = {
        from: `"BookACut" <${process.env.SMTP_USER}>`,
        to: to,
        subject: subject,
        html: html,
        text: text,
        attachments: attachments || [],
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId,
        recipient: to,
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Test email configuration
   * @returns {Promise<Object>} Test result
   */
  async testEmailConfiguration() {
    if (!this.transporter) {
      return {
        success: false,
        message: 'Email service is not configured',
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'Email configuration is valid',
      };
    } catch (error) {
      return {
        success: false,
        message: `Email configuration error: ${error.message}`,
      };
    }
  }
}

module.exports = new EmailService();

