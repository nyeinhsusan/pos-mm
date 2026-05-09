const express = require('express');
const router = express.Router();
const emailLogController = require('../controllers/emailLogController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/', authenticate, authorize(['owner']), emailLogController.getAllEmailLogs);
router.post('/:id/retry', authenticate, authorize(['owner']), emailLogController.retryEmailLog);

module.exports = router;