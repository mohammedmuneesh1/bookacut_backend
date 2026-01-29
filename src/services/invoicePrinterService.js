const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const moment = require('moment');

const execAsync = promisify(exec);

/**
 * Invoice Printer Service
 * Handles invoice printing to various printer types and PDF generation
 */
class InvoicePrinterService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'bookacut_invoices');
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Generate PDF from invoice data
   * @param {Object} invoiceData - Invoice data with populated fields
   * @param {Object} shopData - Shop information
   * @returns {Promise<string>} Path to generated PDF file
   */
  async generatePDF(invoiceData, shopData) {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `invoice_${invoiceData.invoiceNumber}_${Date.now()}.pdf`;
        const filePath = path.join(this.tempDir, fileName);

        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(shopData.name || 'Invoice', { align: 'center' });
        doc.moveDown(0.5);
        
        if (shopData.address) {
          const addressLines = [];
          if (shopData.address.street) addressLines.push(shopData.address.street);
          if (shopData.address.city) addressLines.push(shopData.address.city);
          if (shopData.address.state) addressLines.push(shopData.address.state);
          if (shopData.address.zipCode) addressLines.push(shopData.address.zipCode);
          
          doc.fontSize(10).font('Helvetica').text(addressLines.join(', '), { align: 'center' });
        }
        
        if (shopData.phone) {
          doc.fontSize(10).text(`Phone: ${shopData.phone}`, { align: 'center' });
        }
        if (shopData.email) {
          doc.fontSize(10).text(`Email: ${shopData.email}`, { align: 'center' });
        }

        doc.moveDown(1);

        // Invoice Title
        doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
        doc.moveDown(0.5);

        // Invoice Details
        doc.fontSize(10).font('Helvetica');
        
        const invoiceDate = moment(invoiceData.createdAt).format('MMMM DD, YYYY');
        const invoiceTime = moment(invoiceData.createdAt).format('hh:mm A');

        doc.text(`Invoice Number: ${invoiceData.invoiceNumber}`, { continued: false });
        doc.text(`Date: ${invoiceDate}`, { continued: false });
        doc.text(`Time: ${invoiceTime}`, { continued: false });
        doc.moveDown(0.5);

        // Customer Details
        if (invoiceData.customerId) {
          const customer = invoiceData.customerId;
          doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', { continued: false });
          doc.fontSize(10).font('Helvetica');
          doc.text(`${customer.firstName} ${customer.lastName}`);
          if (customer.email) doc.text(`Email: ${customer.email}`);
          if (customer.phone) doc.text(`Phone: ${customer.phone}`);
          doc.moveDown(0.5);
        }

        // Service Details
        doc.fontSize(12).font('Helvetica-Bold').text('Service Details:', { continued: false });
        doc.fontSize(10).font('Helvetica');
        
        if (invoiceData.serviceId) {
          doc.text(`Service: ${invoiceData.serviceId.name || 'N/A'}`);
        }
        
        if (invoiceData.staffId) {
          doc.text(`Staff: ${invoiceData.staffId.employeeId || 'N/A'}`);
        }

        if (invoiceData.bookingId && invoiceData.bookingId.scheduledAt) {
          const bookingDate = moment(invoiceData.bookingId.scheduledAt).format('MMMM DD, YYYY hh:mm A');
          doc.text(`Booking Date: ${bookingDate}`);
        }

        doc.moveDown(1);

        // Line Items Table
        const tableTop = doc.y;
        const itemHeight = 20;
        const tableWidth = 500;
        const colWidths = {
          description: 200,
          qty: 60,
          price: 100,
          total: 140,
        };

        // Table Header
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Description', 50, tableTop);
        doc.text('Qty', 50 + colWidths.description, tableTop);
        doc.text('Price', 50 + colWidths.description + colWidths.qty, tableTop);
        doc.text('Total', 50 + colWidths.description + colWidths.qty + colWidths.price, tableTop);

        // Table Line
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Service Item
        const itemY = tableTop + itemHeight;
        doc.fontSize(10).font('Helvetica');
        const serviceName = invoiceData.serviceId?.name || 'Service';
        doc.text(serviceName, 50, itemY);
        doc.text('1', 50 + colWidths.description, itemY);
        doc.text(`$${invoiceData.amount.toFixed(2)}`, 50 + colWidths.description + colWidths.qty, itemY);
        doc.text(`$${invoiceData.amount.toFixed(2)}`, 50 + colWidths.description + colWidths.qty + colWidths.price, itemY);

        // Totals Section
        const totalsY = itemY + itemHeight + 20;
        doc.fontSize(10).font('Helvetica');

        let currentY = totalsY;
        
        if (invoiceData.discount > 0) {
          doc.text(`Subtotal:`, 350, currentY, { width: 100, align: 'right' });
          doc.text(`$${invoiceData.amount.toFixed(2)}`, 450, currentY);
          currentY += 15;
          
          doc.text(`Discount:`, 350, currentY, { width: 100, align: 'right' });
          doc.text(`-$${invoiceData.discount.toFixed(2)}`, 450, currentY);
          currentY += 15;
        }

        if (invoiceData.tax > 0) {
          doc.text(`Tax:`, 350, currentY, { width: 100, align: 'right' });
          doc.text(`$${invoiceData.tax.toFixed(2)}`, 450, currentY);
          currentY += 15;
        }

        // Total
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Total:`, 350, currentY, { width: 100, align: 'right' });
        doc.text(`$${invoiceData.totalAmount.toFixed(2)}`, 450, currentY);

        // Payment Status
        currentY += 30;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Status: ${invoiceData.status.toUpperCase()}`, 50, currentY);
        
        if (invoiceData.totalPaidAmount > 0) {
          currentY += 15;
          doc.text(`Paid: $${invoiceData.totalPaidAmount.toFixed(2)}`, 50, currentY);
        }
        
        if (invoiceData.remainingBalance > 0) {
          currentY += 15;
          doc.text(`Remaining: $${invoiceData.remainingBalance.toFixed(2)}`, 50, currentY);
        }

        // Footer
        doc.fontSize(8).font('Helvetica');
        const footerY = doc.page.height - 50;
        doc.text('Thank you for your business!', 50, footerY, { align: 'center', width: 500 });
        doc.text(`Generated on ${moment().format('MMMM DD, YYYY hh:mm A')}`, 50, footerY + 15, { align: 'center', width: 500 });

        doc.end();

        stream.on('finish', () => {
          resolve(filePath);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Print to USB printer
   * @param {string} pdfPath - Path to PDF file
   * @param {string} printerName - Name of the printer (optional, uses default if not provided)
   * @returns {Promise<Object>} Print result
   */
  async printToUSB(pdfPath, printerName = null) {
    try {
      const platform = os.platform();
      let command;

      if (platform === 'win32') {
        // Windows: Use default printer or specified printer
        if (printerName) {
          command = `"${pdfPath}" /t /printer:"${printerName}"`;
          await execAsync(`start "" ${command}`);
        } else {
          // Use default printer
          command = `"${pdfPath}" /t`;
          await execAsync(`start "" ${command}`);
        }
      } else if (platform === 'darwin') {
        // macOS
        if (printerName) {
          command = `lp -d "${printerName}" "${pdfPath}"`;
        } else {
          command = `lp "${pdfPath}"`;
        }
        await execAsync(command);
      } else {
        // Linux
        if (printerName) {
          command = `lp -d "${printerName}" "${pdfPath}"`;
        } else {
          command = `lp "${pdfPath}"`;
        }
        await execAsync(command);
      }

      return {
        success: true,
        message: `Invoice sent to ${printerName || 'default'} printer`,
        printerType: 'USB',
      };
    } catch (error) {
      throw new Error(`USB printer error: ${error.message}`);
    }
  }

  /**
   * Print to Network printer
   * @param {string} pdfPath - Path to PDF file
   * @param {string} printerIP - IP address of the network printer
   * @param {number} port - Port number (default: 9100)
   * @param {string} printerName - Optional printer name
   * @returns {Promise<Object>} Print result
   */
  async printToNetwork(pdfPath, printerIP, port = 9100, printerName = null) {
    try {
      const platform = os.platform();
      let command;

      // First, add network printer if not already added
      if (printerName) {
        if (platform === 'win32') {
          // Windows: Add network printer using IP
          const printerPath = `\\\\${printerIP}\\${printerName}`;
          // Note: This is a simplified approach. In production, you might want to use a proper printer driver
          command = `net use "${printerPath}" /persistent:yes`;
          try {
            await execAsync(command);
          } catch (error) {
            // Printer might already be added, continue
          }
        }
      }

      // Print to network printer
      if (platform === 'win32') {
        // Windows: Print via network share or IP
        const printerPath = printerName ? `\\\\${printerIP}\\${printerName}` : `\\\\${printerIP}`;
        command = `"${pdfPath}" /t /printer:"${printerPath}"`;
        await execAsync(`start "" ${command}`);
      } else {
        // Linux/macOS: Use lp with IP address
        const printerURI = `ipp://${printerIP}:${port}/ipp/print`;
        command = `lp -d "${printerURI}" "${pdfPath}"`;
        await execAsync(command);
      }

      return {
        success: true,
        message: `Invoice sent to network printer at ${printerIP}:${port}`,
        printerType: 'Network',
        printerIP,
        port,
      };
    } catch (error) {
      throw new Error(`Network printer error: ${error.message}`);
    }
  }

  /**
   * Print to Bluetooth printer
   * @param {string} pdfPath - Path to PDF file
   * @param {string} deviceAddress - Bluetooth device address (MAC address)
   * @param {string} printerName - Optional printer name
   * @returns {Promise<Object>} Print result
   */
  async printToBluetooth(pdfPath, deviceAddress, printerName = null) {
    try {
      const platform = os.platform();
      let command;

      // Note: Bluetooth printing requires the printer to be paired and accessible
      // This is a simplified implementation. Actual implementation may vary based on OS and printer model
      
      if (platform === 'win32') {
        // Windows: Bluetooth printers are typically accessible as regular printers once paired
        // The printer should appear in the system printers list
        const printerDisplayName = printerName || `Bluetooth Printer (${deviceAddress})`;
        command = `"${pdfPath}" /t /printer:"${printerDisplayName}"`;
        await execAsync(`start "" ${command}`);
      } else if (platform === 'darwin') {
        // macOS: Use lp with Bluetooth printer name
        const btPrinterName = printerName || deviceAddress;
        command = `lp -d "${btPrinterName}" "${pdfPath}"`;
        await execAsync(command);
      } else {
        // Linux: Use CUPS with Bluetooth printer
        // Note: Bluetooth printer must be configured in CUPS first
        const btPrinterName = printerName || deviceAddress;
        command = `lp -d "${btPrinterName}" "${pdfPath}"`;
        await execAsync(command);
      }

      return {
        success: true,
        message: `Invoice sent to Bluetooth printer (${deviceAddress})`,
        printerType: 'Bluetooth',
        deviceAddress,
      };
    } catch (error) {
      throw new Error(`Bluetooth printer error: ${error.message}`);
    }
  }

  /**
   * Get list of available printers
   * @returns {Promise<Array>} List of available printers
   */
  async getAvailablePrinters() {
    try {
      const platform = os.platform();
      let command;

      if (platform === 'win32') {
        command = 'wmic printer get name,default';
      } else if (platform === 'darwin') {
        command = 'lpstat -p -d';
      } else {
        command = 'lpstat -p -d';
      }

      const { stdout } = await execAsync(command);
      const printers = [];

      if (platform === 'win32') {
        // Parse Windows printer list
        const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Name') && !line.includes('---'));
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0) {
            const name = parts[0];
            const isDefault = line.toLowerCase().includes('true');
            printers.push({
              name,
              isDefault,
              type: 'USB', // Default assumption
            });
          }
        });
      } else {
        // Parse Unix/macOS printer list
        const lines = stdout.split('\n');
        lines.forEach(line => {
          if (line.includes('printer')) {
            const match = line.match(/printer\s+(\S+)/);
            if (match) {
              printers.push({
                name: match[1],
                isDefault: line.includes('is idle'),
                type: 'USB', // Default assumption
              });
            }
          }
        });
      }

      return printers;
    } catch (error) {
      console.error('Error getting printer list:', error);
      return [];
    }
  }

  /**
   * Clean up temporary PDF files older than 1 hour
   */
  async cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > oneHour) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }
}

module.exports = new InvoicePrinterService();

