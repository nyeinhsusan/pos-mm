const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const vendorInvoiceController = require('../controllers/vendorInvoiceController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Ensure upload directory exists at boot
const UPLOAD_DIR = 'uploads/vendor-invoices';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'invoice-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExt = /pdf|jpeg|jpg|png|webp/;
  const allowedMime = /pdf|jpeg|jpg|png|webp/;
  const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMime.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF or image files allowed (pdf, jpeg, jpg, png, webp)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// All owner-only
router.get('/', authenticate, authorize(['owner']), vendorInvoiceController.getAllInvoices);
router.get('/summary', authenticate, authorize(['owner']), vendorInvoiceController.getSummary);
router.get('/:id', authenticate, authorize(['owner']), vendorInvoiceController.getInvoiceById);
router.post('/', authenticate, authorize(['owner']), vendorInvoiceController.createInvoice);
router.put('/:id', authenticate, authorize(['owner']), vendorInvoiceController.updateInvoice);
router.post('/:id/mark-paid', authenticate, authorize(['owner']), vendorInvoiceController.markPaid);
router.post(
  '/:id/attachment',
  authenticate,
  authorize(['owner']),
  upload.single('attachment'),
  vendorInvoiceController.uploadAttachment
);
router.delete('/:id', authenticate, authorize(['owner']), vendorInvoiceController.deleteInvoice);

module.exports = router;
