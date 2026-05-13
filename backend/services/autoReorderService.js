const { pool } = require('../config/database');
const vendorSettingsService = require('./vendorSettingsService');
const mlService = require('./mlService');
const PurchaseOrder = require('../models/PurchaseOrder');
const { sendPurchaseOrderById } = require('./purchaseOrderSendService');

const SYSTEM_USER_EMAIL = 'system@auto.local';
let cachedSystemUserId = null;

async function getSystemUserId() {
  if (cachedSystemUserId) return cachedSystemUserId;
  const [rows] = await pool.query(
    'SELECT user_id FROM users WHERE email = ? LIMIT 1',
    [SYSTEM_USER_EMAIL]
  );
  if (rows.length === 0) {
    throw new Error('System user not found — apply migration 013_add_system_user.sql');
  }
  cachedSystemUserId = rows[0].user_id;
  return cachedSystemUserId;
}

/**
 * Auto-Reorder Service (Story 30)
 *
 * Deterministic feed for Story 31. Reads vendor_settings, queries the ML
 * inventory-predictions endpoint, applies the trigger rule (stockout within
 * lead_time + buffer), groups triggered products by preferred vendor, and
 * returns a vendor-bucketed result.
 *
 * NO database writes. NO PO creation. NO email sending. Logging only.
 *
 * ML response shape (documented from real call against ml-service, 2026-05-13):
 *   {
 *     count: number,
 *     generated_at: ISO string,
 *     predictions: [
 *       { product_id, product_name, current_stock, daily_velocity,
 *         days_until_stockout, predicted_stockout_date (YYYY-MM-DD),
 *         recommended_reorder_qty, status }
 *     ],
 *     fallback?: boolean   // true when ML is unreachable; predictions === []
 *   }
 */

const LOG = '[auto-reorder]';

function todayPlusDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function isPredictionValid(p) {
  return (
    p &&
    typeof p === 'object' &&
    Number.isFinite(Number(p.product_id)) &&
    typeof p.predicted_stockout_date === 'string'
  );
}

/**
 * Look up preferred vendors for a list of product_ids in one query.
 * Returns Map<product_id, vendorRow | null>.
 */
async function loadPreferredVendors(productIds) {
  if (productIds.length === 0) return new Map();
  const placeholders = productIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT vp.product_id, vp.vendor_id, vp.default_reorder_qty, vp.vendor_cost_price,
            v.name AS vendor_name, v.lead_time_days, v.email AS vendor_email,
            v.status AS vendor_status
     FROM vendor_products vp
     JOIN vendors v ON v.vendor_id = vp.vendor_id
     WHERE vp.product_id IN (${placeholders}) AND vp.is_preferred = 1`,
    productIds
  );
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.product_id), r);
  }
  return map;
}

async function runScan(options = {}) {
  const t0 = Date.now();
  const timestamp = new Date().toISOString();

  // 1. Load settings
  const settings = await vendorSettingsService.getSettings();
  const mode = settings.auto_reorder_mode;
  const buffer = Number(settings.lead_time_buffer_days || 0);

  // 2. Disabled mode short-circuit
  if (mode === 'disabled') {
    console.log(`${LOG} mode=disabled, skipping scan`);
    return {
      skipped: true,
      reason: 'disabled',
      timestamp,
      mode,
      duration_ms: Date.now() - t0
    };
  }

  // 3. Call ML service
  let mlData;
  try {
    mlData = await mlService.getInventoryPredictions();
  } catch (err) {
    console.error(`${LOG} ML service threw: ${err.message}`);
    return {
      skipped: true,
      reason: 'ml_unavailable',
      timestamp,
      mode,
      error_message: err.message,
      duration_ms: Date.now() - t0
    };
  }

  if (!mlData || mlData.fallback === true || !Array.isArray(mlData.predictions)) {
    console.warn(`${LOG} ML returned fallback or invalid shape — treating as unavailable`);
    return {
      skipped: true,
      reason: 'ml_unavailable',
      timestamp,
      mode,
      error_message: mlData?.error || 'invalid ML response shape',
      duration_ms: Date.now() - t0
    };
  }

  const rawPredictions = mlData.predictions.filter(isPredictionValid);
  if (rawPredictions.length !== mlData.predictions.length) {
    console.warn(
      `${LOG} dropped ${mlData.predictions.length - rawPredictions.length} predictions with invalid shape`
    );
  }

  // 4. Preferred vendor lookup
  const productIds = rawPredictions.map((p) => Number(p.product_id));
  const vendorMap = await loadPreferredVendors(productIds);

  // 5. Apply trigger rule + bucketize
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);

  const buckets = new Map(); // vendor_id → bucket
  const unreachable = [];
  let notYetCriticalCount = 0;

  for (const p of rawPredictions) {
    const productId = Number(p.product_id);
    const vendorRow = vendorMap.get(productId);

    if (!vendorRow) {
      unreachable.push({ product_id: productId, reason: 'no_preferred_vendor' });
      continue;
    }
    if (vendorRow.vendor_status !== 'active') {
      unreachable.push({ product_id: productId, reason: 'vendor_archived' });
      continue;
    }

    const stockoutDate = new Date(p.predicted_stockout_date);
    if (Number.isNaN(stockoutDate.getTime())) {
      unreachable.push({ product_id: productId, reason: 'invalid_stockout_date' });
      continue;
    }
    stockoutDate.setHours(0, 0, 0, 0);

    const leadTime = Number(vendorRow.lead_time_days || 0);
    const window = todayPlusDays(leadTime + buffer);

    if (stockoutDate > window) {
      notYetCriticalCount += 1;
      continue;
    }

    // Trigger this product → bucket under vendor
    let bucket = buckets.get(vendorRow.vendor_id);
    if (!bucket) {
      bucket = {
        vendor_id: vendorRow.vendor_id,
        vendor_name: vendorRow.vendor_name,
        vendor_email: vendorRow.vendor_email,
        vendor_lead_time_days: leadTime,
        products: []
      };
      buckets.set(vendorRow.vendor_id, bucket);
    }

    const confidence = typeof p.confidence === 'number' ? p.confidence : null;

    bucket.products.push({
      product_id: productId,
      product_name: p.product_name || null,
      default_reorder_qty:
        Number(vendorRow.default_reorder_qty) || Number(p.recommended_reorder_qty) || 1,
      vendor_cost_price: Number(vendorRow.vendor_cost_price) || 0,
      predicted_stockout_date: p.predicted_stockout_date,
      confidence,
      current_stock: Number(p.current_stock) || 0,
      low_confidence: confidence != null && confidence < 0.6
    });
  }

  const vendorBuckets = Array.from(buckets.values());
  const triggeredCount = vendorBuckets.reduce((s, b) => s + b.products.length, 0);

  const result = {
    skipped: false,
    timestamp,
    mode,
    ml_predictions_total: rawPredictions.length,
    triggered_products: triggeredCount,
    unreachable_products: unreachable,
    not_yet_critical_count: notYetCriticalCount,
    vendor_buckets: vendorBuckets,
    duration_ms: Date.now() - t0
  };

  console.log(
    `${LOG} scan complete: mode=${mode} ml=${rawPredictions.length} triggered=${triggeredCount} vendors=${vendorBuckets.length} unreachable=${unreachable.length} notYet=${notYetCriticalCount} (${result.duration_ms}ms)`
  );

  return result;
}

/**
 * Returns true if there's already an open or recent PO covering this
 * (vendor, product) pair within the dedup window (`leadTimeDays * 1.5` days,
 * minimum 1 day). Open = draft / sent / partially_received.
 */
async function hasRecentPo(vendorId, productId, leadTimeDays) {
  const windowDays = Math.max(1, Math.ceil(Number(leadTimeDays || 7) * 1.5));
  const [rows] = await pool.query(
    `SELECT 1
     FROM purchase_orders po
     JOIN purchase_order_items poi ON po.po_id = poi.po_id
     WHERE po.vendor_id = ?
       AND poi.product_id = ?
       AND po.status IN ('draft','sent','partially_received')
       AND po.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
     LIMIT 1`,
    [vendorId, productId, windowDays]
  );
  return rows.length > 0;
}

function buildAutoNote(bucket, todayIso, droppedProducts) {
  const lowConfidence = bucket.products.filter((p) => p.low_confidence).map((p) => `P-${p.product_id}`);
  const lines = [`Auto-generated from ML predictions on ${todayIso}.`];
  if (lowConfidence.length > 0) {
    lines.push(`Low-confidence lines flagged: ${lowConfidence.join(', ')}.`);
  }
  if (droppedProducts.length > 0) {
    lines.push(
      `Dropped (recent PO exists): ${droppedProducts.map((p) => `P-${p.product_id}`).join(', ')}.`
    );
  }
  return lines.join(' ');
}

async function insertRunRow({ mode, triggered_by = 'cron', actor_user_id = null }) {
  try {
    const [result] = await pool.query(
      `INSERT INTO auto_reorder_runs (mode, status, triggered_by, actor_user_id)
       VALUES (?, 'running', ?, ?)`,
      [mode || 'unknown', triggered_by, actor_user_id]
    );
    return result.insertId;
  } catch (err) {
    console.warn(`${LOG} could not insert auto_reorder_runs row: ${err.message}`);
    return null;
  }
}

async function finishRunRow(runId, fields, detailsJson) {
  if (!runId) return;
  try {
    await pool.query(
      `UPDATE auto_reorder_runs
       SET finished_at = NOW(),
           status = ?,
           triggered_products_count = ?,
           created_pos_count = ?,
           failed_creations_count = ?,
           auto_sent_count = ?,
           auto_send_failed_count = ?,
           error_message = ?,
           details_json = ?
       WHERE run_id = ?`,
      [
        fields.status,
        fields.triggered_products_count,
        fields.created_pos_count,
        fields.failed_creations_count,
        fields.auto_sent_count,
        fields.auto_send_failed_count,
        fields.error_message,
        detailsJson != null ? JSON.stringify(detailsJson) : null,
        runId
      ]
    );
  } catch (err) {
    console.warn(`${LOG} could not finish auto_reorder_runs row ${runId}: ${err.message}`);
  }
}

async function runAndCreate(options = {}) {
  const t0 = Date.now();
  const { triggered_by = 'cron', actor_user_id = null } = options;

  // Insert run row early so we always have an audit record even if scan blows up.
  let settingsForMode;
  try {
    settingsForMode = await vendorSettingsService.getSettings();
  } catch (e) {
    settingsForMode = { auto_reorder_mode: 'unknown' };
  }
  const runId = await insertRunRow({
    mode: settingsForMode.auto_reorder_mode,
    triggered_by,
    actor_user_id
  });

  const scan = await runScan(options);

  if (scan.skipped) {
    const skippedStatus = scan.reason === 'disabled' ? 'disabled' : 'ml_unavailable';
    const finalSkipped = {
      ...scan,
      buckets_count: 0,
      created_pos: [],
      failed_creations: [],
      auto_sent_results: [],
      run_id: runId
    };
    await finishRunRow(
      runId,
      {
        status: skippedStatus,
        triggered_products_count: 0,
        created_pos_count: 0,
        failed_creations_count: 0,
        auto_sent_count: 0,
        auto_send_failed_count: 0,
        error_message: scan.error_message || null
      },
      finalSkipped
    );
    return finalSkipped;
  }

  const systemUserId = await getSystemUserId();
  const settings = await vendorSettingsService.getSettings();
  const mode = settings.auto_reorder_mode;
  const todayIso = new Date().toISOString().slice(0, 10);

  const created = [];
  const failed = [];
  const autoSent = [];

  for (const bucket of scan.vendor_buckets) {
    // Duplicate prevention: drop products that already have an open or recent PO.
    const dropped = [];
    const kept = [];
    for (const p of bucket.products) {
      try {
        if (await hasRecentPo(bucket.vendor_id, p.product_id, bucket.vendor_lead_time_days)) {
          dropped.push(p);
        } else {
          kept.push(p);
        }
      } catch (err) {
        console.warn(`${LOG} dup-check failed for vendor=${bucket.vendor_id} product=${p.product_id}: ${err.message}`);
        kept.push(p);
      }
    }

    if (kept.length === 0) {
      console.log(
        `${LOG} vendor=${bucket.vendor_id} (${bucket.vendor_name}) → all ${dropped.length} products covered by recent POs, skipping`
      );
      continue;
    }

    const payload = {
      vendor_id: bucket.vendor_id,
      source: 'auto_ml',
      notes: buildAutoNote({ ...bucket, products: kept }, todayIso, dropped),
      items: kept.map((p) => ({
        product_id: p.product_id,
        quantity_ordered: p.default_reorder_qty || 1,
        unit_cost: p.vendor_cost_price || 0,
        tax_amount: 0,
        ml_confidence: p.confidence != null ? p.confidence : null
      })),
      created_by_user_id: systemUserId
    };

    let createdPo;
    try {
      createdPo = await PurchaseOrder.create(payload);
    } catch (err) {
      console.error(
        `${LOG} PO creation failed for vendor ${bucket.vendor_id} (${bucket.vendor_name}): ${err.message}`
      );
      failed.push({
        vendor_id: bucket.vendor_id,
        vendor_name: bucket.vendor_name,
        error_code: err.code || 'CREATE_FAILED',
        error_message: err.message
      });
      continue;
    }

    created.push({
      po_id: createdPo.po_id,
      po_number: createdPo.po_number,
      vendor_id: bucket.vendor_id,
      vendor_name: bucket.vendor_name,
      item_count: kept.length,
      total: Number(createdPo.total) || 0
    });

    console.log(
      `${LOG} created PO ${createdPo.po_number} for vendor ${bucket.vendor_id} (${bucket.vendor_name}) with ${kept.length} items`
    );

    // Auto-send branch
    if (mode === 'auto_send') {
      try {
        const sendResult = await sendPurchaseOrderById(createdPo.po_id, systemUserId);
        autoSent.push({
          po_id: createdPo.po_id,
          status: sendResult.status,
          email_log_id: sendResult.email_log_id,
          last_error: sendResult.last_error || null
        });
        if (sendResult.status === 'sent') {
          console.log(`${LOG} PO ${createdPo.po_number} auto-sent successfully`);
        } else {
          console.warn(
            `${LOG} PO ${createdPo.po_number} auto-send FAILED — PO stays draft. log_id=${sendResult.email_log_id}`
          );
        }
      } catch (err) {
        console.error(`${LOG} PO ${createdPo.po_number} auto-send threw: ${err.message}`);
        autoSent.push({
          po_id: createdPo.po_id,
          status: 'failed',
          error_code: err.code || 'SEND_THREW',
          last_error: err.message
        });
      }
    }
  }

  const autoSendFailed = autoSent.filter((r) => r.status !== 'sent').length;
  const overallStatus =
    failed.length > 0 || autoSendFailed > 0 ? 'partial_failure' : 'success';

  const result = {
    skipped: false,
    timestamp: scan.timestamp,
    mode,
    buckets_count: scan.vendor_buckets.length,
    ml_predictions_total: scan.ml_predictions_total,
    triggered_products: scan.triggered_products,
    unreachable_products: scan.unreachable_products,
    not_yet_critical_count: scan.not_yet_critical_count,
    created_pos: created,
    failed_creations: failed,
    auto_sent_results: autoSent,
    duration_ms: Date.now() - t0,
    run_id: runId,
    overall_status: overallStatus
  };

  await finishRunRow(
    runId,
    {
      status: overallStatus,
      triggered_products_count: scan.triggered_products,
      created_pos_count: created.length,
      failed_creations_count: failed.length,
      auto_sent_count: autoSent.filter((r) => r.status === 'sent').length,
      auto_send_failed_count: autoSendFailed,
      error_message: null
    },
    result
  );

  console.log(
    `${LOG} runAndCreate complete: mode=${mode} created=${created.length} failed=${failed.length} autoSent=${autoSent.length} (${result.duration_ms}ms)`
  );

  return result;
}

module.exports = { runScan, runAndCreate };
