const express = require('express');
const router = express.Router();
const vendorSettingsController = require('../controllers/vendorSettingsController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/', authenticate, authorize(['owner']), vendorSettingsController.getSettings);
router.put('/', authenticate, authorize(['owner']), vendorSettingsController.updateSettings);
router.post('/test-email', authenticate, authorize(['owner']), vendorSettingsController.testEmail);

module.exports = router;