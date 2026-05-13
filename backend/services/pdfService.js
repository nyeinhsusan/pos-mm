const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const StoreConfig = require('../models/StoreConfig');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'purchase-orders');

function ensureDirectory() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function formatMMK(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('en-US') + ' MMK';
}

function getDefaultBranding() {
  return {
    shopName: 'POS Myanmar',
    logoUrl: null,
    address: null,
    phone: null,
    currency: 'MMK'
  };
}

async function getShopBranding() {
  try {
    const config = await StoreConfig.get();
    if (!config) {
      return getDefaultBranding();
    }
    return {
      shopName: config.store_name || 'POS Myanmar',
      logoUrl: config.logo_url || null,
      address: config.address || null,
      phone: config.phone || null,
      currency: config.currency || 'MMK'
    };
  } catch (err) {
    console.error('[pdfService] Failed to load shop branding:', err.message);
    return getDefaultBranding();
  }
}

function resolveLogoPath(logoUrl) {
  if (!logoUrl) return null;
  let relativePath = logoUrl;
  if (logoUrl.startsWith('/uploads/')) {
    relativePath = logoUrl.replace(/^\/uploads\//, '');
  }
  const absolutePath = path.join(__dirname, '..', 'uploads', relativePath);
  if (fs.existsSync(absolutePath)) {
    return absolutePath;
  }
  return null;
}

/**
 * Generate a PDF for a Purchase Order
 * @param {Object} po - The populated PO object from PurchaseOrder.findById
 * @param {Object} shopBranding - Shop branding config
 * @returns {Promise<{ filePath: string, fileName: string, url: string }>}
 */
async function generatePoPdf(po, shopBranding) {
  ensureDirectory();

  const branding = shopBranding || await getShopBranding();
  const fileName = `${po.po_number}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const url = `/uploads/purchase-orders/${fileName}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    const SHOP_NAME = branding.shopName || 'POS Myanmar';
    const SHOP_ADDRESS = branding.address || '';
    const SHOP_PHONE = branding.phone || '';
    const CURRENCY = branding.currency || 'MMK';

    let yPos = 50;

    // Header with logo
    const logoPath = resolveLogoPath(branding.logoUrl);
    if (logoPath) {
      try {
        doc.image(logoPath, 50, yPos, { width: 60, height: 60 });
      } catch (imgErr) {
        console.error('[pdfService] Failed to embed logo:', imgErr.message);
      }
    }

    doc.fontSize(20).font('Helvetica-Bold').text(SHOP_NAME, 130, yPos);
    if (SHOP_ADDRESS) {
      doc.fontSize(10).font('Helvetica').text(SHOP_ADDRESS, 130, yPos + 28, { width: 300 });
    }
    if (SHOP_PHONE) {
      doc.fontSize(10).font('Helvetica').text(`Tel: ${SHOP_PHONE}`, 130, yPos + 76);
    }

    yPos = 130;

    // PO Number and Date
    doc.fontSize(14).font('Helvetica-Bold').text(`Purchase Order: ${po.po_number}`, 50, yPos);
    doc.fontSize(10).font('Helvetica').text(`Date: ${new Date(po.created_at).toLocaleDateString()}`, 50, yPos + 18);

    yPos = 170;

    // Vendor Info Card
    doc.fontSize(12).font('Helvetica-Bold').text('Vendor:', 50, yPos);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${po.vendor?.name || 'N/A'}`, 50, yPos + 15);
    if (po.vendor?.contact_name) {
      doc.text(`Contact: ${po.vendor.contact_name}`, 50, yPos + 28);
    }
    if (po.vendor?.email) {
      doc.text(`Email: ${po.vendor.email}`, 50, yPos + 41);
    }
    if (po.vendor?.phone) {
      doc.text(`Phone: ${po.vendor.phone}`, 50, yPos + 54);
    }
    if (po.vendor?.lead_time_days) {
      doc.text(`Lead Time: ${po.vendor.lead_time_days} days`, 50, yPos + 67);
    }

    yPos = 260;

    // Items Table Header
    const tableTop = yPos;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('No.', 50, tableTop, { width: 30 });
    doc.text('Product', 80, tableTop, { width: 200 });
    doc.text('Qty', 290, tableTop, { width: 40, align: 'right' });
    doc.text('Unit Cost', 335, tableTop, { width: 70, align: 'right' });
    doc.text('Tax', 410, tableTop, { width: 60, align: 'right' });
    doc.text('Total', 475, tableTop, { width: 70, align: 'right' });

    // Draw header line
    doc.moveTo(50, tableTop + 12).lineTo(545, tableTop + 12).stroke();

    // Items
    let rowY = tableTop + 18;
    const items = po.items || [];
    let pageNumber = 1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty = Number(item.quantity_ordered) || 0;
      const unitCost = Number(item.unit_cost) || 0;
      const tax = Number(item.tax_amount) || 0;
      const lineTotal = (qty * unitCost) + tax;

      // Check if we need a new page
      if (rowY > 700) {
        doc.addPage();
        pageNumber++;
        rowY = 50;

        // Repeat header on new page
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('No.', 50, rowY, { width: 30 });
        doc.text('Product', 80, rowY, { width: 200 });
        doc.text('Qty', 290, rowY, { width: 40, align: 'right' });
        doc.text('Unit Cost', 335, rowY, { width: 70, align: 'right' });
        doc.text('Tax', 410, rowY, { width: 60, align: 'right' });
        doc.text('Total', 475, rowY, { width: 70, align: 'right' });
        doc.moveTo(50, rowY + 12).lineTo(545, rowY + 12).stroke();
        rowY += 18;
      }

      doc.fontSize(9).font('Helvetica');
      const productName = item.product_name || `Product #${item.product_id}`;
      doc.text(`${i + 1}`, 50, rowY, { width: 30 });
      doc.text(productName, 80, rowY, { width: 200 });
      doc.text(qty.toString(), 290, rowY, { width: 40, align: 'right' });
      doc.text(formatMMK(unitCost), 335, rowY, { width: 70, align: 'right' });
      doc.text(formatMMK(tax), 410, rowY, { width: 60, align: 'right' });
      doc.text(formatMMK(lineTotal), 475, rowY, { width: 70, align: 'right' });

      rowY += 15;
    }

    // Totals
    rowY += 10;
    doc.moveTo(350, rowY).lineTo(545, rowY).stroke();
    rowY += 10;

    doc.fontSize(10).font('Helvetica');
    doc.text('Subtotal:', 350, rowY, { width: 100, align: 'right' });
    doc.text(formatMMK(po.subtotal), 460, rowY, { width: 85, align: 'right' });

    rowY += 15;
    doc.text('Tax:', 350, rowY, { width: 100, align: 'right' });
    doc.text(formatMMK(po.tax_amount), 460, rowY, { width: 85, align: 'right' });

    rowY += 15;
    doc.fontSize(12).font('Helvetica-Bold').text('TOTAL:', 350, rowY, { width: 100, align: 'right' });
    doc.text(formatMMK(po.total), 460, rowY, { width: 85, align: 'right' });

    // Notes
    if (po.notes) {
      rowY += 35;
      doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50, rowY);
      doc.fontSize(9).font('Helvetica').text(po.notes, 50, rowY + 15, { width: 495 });
    }

    // Footer - disclaimer for auto-generated POs
    if (po.source === 'auto_ml') {
      const footerY = doc.page.height - 50;
      doc.fontSize(8).font('Helvetica-Oblique').text(
        'This purchase order was automatically generated by our AI system. Please verify all items before confirming.',
        50,
        footerY,
        { width: 495, align: 'center' }
      );
    }

    // Page numbers
    const pages = doc.bufferedPageRange();
    for (let p = 0; p < pages.count; p++) {
      doc.switchToPage(p);
      doc.fontSize(8).font('Helvetica').text(
        `Page ${p + 1} of ${pages.count}`,
        50,
        doc.page.height - 30,
        { width: 495, align: 'center' }
      );
    }

    doc.end();

    writeStream.on('finish', () => {
      resolve({ filePath, fileName, url });
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { generatePoPdf, getShopBranding };