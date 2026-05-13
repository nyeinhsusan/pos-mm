const { pool } = require('../config/database');
const autoReorderService = require('../services/autoReorderService');
const vendorSettingsService = require('../services/vendorSettingsService');

// Simple in-memory cache for pending-approval-count (30 second TTL)
let pendingApprovalCache = { count: null, timestamp: null };
const PENDING_CACHE_TTL_MS = 30 * 1000;

/**
 * POST /api/auto-reorder/run-now
 *
 * Manually trigger an auto-reorder scan.
 * Body: { dryRun?: boolean }
 */
exports.runAutoReorderNow = async (req, res) => {
  try {
    const { dryRun } = req.body || {};

    // Concurrency guard: check if a run is already in progress
    const [lockRows] = await pool.query(
      `SELECT run_id FROM auto_reorder_runs
       WHERE finished_at IS NULL
         AND started_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       LIMIT 1`
    );

    if (lockRows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'RUN_IN_PROGRESS',
          message: 'A run is already in progress. Wait for the current run to finish.'
        }
      });
    }

    let result;
    if (dryRun === true) {
      // Dry run: just scan, no PO creation
      result = await autoReorderService.runScan();
      result.dry_run = true;
    } else {
      // Full run
      result = await autoReorderService.runAndCreate({
        triggered_by: 'manual',
        actor_user_id: req.user?.user_id
      });
    }

    res.status(200).json({
      success: true,
      data: {
        dry_run: dryRun === true,
        run_id: result.run_id,
        skipped: result.skipped,
        reason: result.reason,
        timestamp: result.timestamp,
        mode: result.mode,
        buckets_count: result.buckets_count,
        triggered_products: result.triggered_products,
        created_pos: result.created_pos,
        auto_sent_results: result.auto_sent_results,
        failed_creations: result.failed_creations
      }
    });
  } catch (error) {
    console.error('Run auto-reorder now error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to run auto-reorder' }
    });
  }
};

/**
 * GET /api/auto-reorder/activity
 *
 * Paginated activity log from auto_reorder_runs.
 * Query params: days, triggered_by, status, page, pageSize, include
 */
exports.getAutoReorderActivity = async (req, res) => {
  try {
    const {
      days = 7,
      triggered_by,
      status,
      page = 1,
      pageSize = 20,
      include
    } = req.query;

    const daysNum = Math.min(90, Math.max(1, parseInt(days, 10) || 7));
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    let whereClause = 'WHERE started_at > DATE_SUB(NOW(), INTERVAL ? DAY)';
    const params = [daysNum];

    if (triggered_by && triggered_by !== 'all') {
      whereClause += ' AND triggered_by = ?';
      params.push(triggered_by);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM auto_reorder_runs ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get rows with actor username
    const [rows] = await pool.query(
      `SELECT
         arr.run_id,
         arr.started_at,
         arr.finished_at,
         arr.mode,
         arr.status,
         arr.triggered_by,
         arr.actor_user_id,
         arr.triggered_products_count,
         arr.created_pos_count,
         arr.failed_creations_count,
         arr.auto_sent_count,
         arr.auto_send_failed_count,
         arr.error_message,
         ${include === 'details' ? 'arr.details_json' : 'NULL'} as details_json,
         u.full_name as actor_name
       FROM auto_reorder_runs arr
       LEFT JOIN users u ON arr.actor_user_id = u.user_id
       ${whereClause}
       ORDER BY arr.started_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSizeNum, offset]
    );

    res.status(200).json({
      success: true,
      data: {
        runs: rows.map((r) => ({
          run_id: r.run_id,
          started_at: r.started_at,
          finished_at: r.finished_at,
          mode: r.mode,
          status: r.status,
          triggered_by: r.triggered_by,
          actor_user_id: r.actor_user_id,
          actor_name: r.actor_name,
          triggered_products_count: r.triggered_products_count,
          created_pos_count: r.created_pos_count,
          failed_creations_count: r.failed_creations_count,
          auto_sent_count: r.auto_sent_count,
          auto_send_failed_count: r.auto_send_failed_count,
          error_message: r.error_message,
          details_json: r.details_json,
          duration_ms: r.finished_at && r.started_at
            ? new Date(r.finished_at) - new Date(r.started_at)
            : null
        })),
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (error) {
    console.error('Get auto-reorder activity error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get activity log' }
    });
  }
};

/**
 * GET /api/auto-reorder/pending-approval-count
 *
 * Returns count of auto-generated POs awaiting approval (draft status).
 */
exports.getPendingApprovalCount = async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (
      pendingApprovalCache.count !== null &&
      pendingApprovalCache.timestamp &&
      now - pendingApprovalCache.timestamp < PENDING_CACHE_TTL_MS
    ) {
      return res.status(200).json({
        success: true,
        data: { count: pendingApprovalCache.count }
      });
    }

    const [rows] = await pool.query(
      `SELECT COUNT(*) as count
       FROM purchase_orders
       WHERE source = 'auto_ml' AND status = 'draft'`
    );

    const count = rows[0].count;

    // Update cache
    pendingApprovalCache = { count, timestamp: now };

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get pending approval count error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get pending approval count' }
    });
  }
};