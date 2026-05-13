const cron = require('node-cron');
const vendorSettingsService = require('./services/vendorSettingsService');
const autoReorderService = require('./services/autoReorderService');

/**
 * Cron registration for auto-reorder (Story 30).
 *
 * Reads `auto_reorder_cron` from vendor_settings and schedules a daily-ish
 * scan. Story 32 will wire live-reload from the settings update path.
 *
 * Timezone: hard-coded to Asia/Yangon to match the shop's local time (POS Myanmar).
 * If you deploy elsewhere, update VENDOR_AUTO_REORDER_TIMEZONE in env or change here.
 */

const LOG = '[auto-reorder]';
const DEFAULT_CRON = '0 2 * * *'; // daily 02:00
const TIMEZONE = process.env.VENDOR_AUTO_REORDER_TIMEZONE || 'Asia/Yangon';

let scheduledTask = null;
let currentExpression = null;

function makeTask(expr) {
  return cron.schedule(
    expr,
    async () => {
      try {
        console.log(`${LOG} cron fired at ${new Date().toISOString()}`);
        // Story 31: cron runs the full pipeline (scan → create POs → optionally auto-send).
        // runScan() is still exported for Story 33's dry-run run-now endpoint.
        const result = await autoReorderService.runAndCreate();
        if (result.skipped) {
          console.log(`${LOG} skipped: ${result.reason}`);
        } else {
          console.log(
            `${LOG} buckets: ${result.buckets_count}, created: ${result.created_pos.length}, autoSent: ${result.auto_sent_results.length}, failed: ${result.failed_creations.length}`
          );
        }
      } catch (err) {
        console.error(`${LOG} scan error`, err);
      }
    },
    { scheduled: false, timezone: TIMEZONE }
  );
}

async function registerCronJobs() {
  if (process.env.NODE_ENV === 'test') {
    console.log(`${LOG} skipping cron registration (NODE_ENV=test)`);
    return;
  }

  let expression;
  try {
    const settings = await vendorSettingsService.getSettings();
    expression = settings.auto_reorder_cron || DEFAULT_CRON;
  } catch (err) {
    console.warn(`${LOG} could not load vendor_settings (${err.message}); using default cron`);
    expression = DEFAULT_CRON;
  }

  if (!cron.validate(expression)) {
    console.warn(`${LOG} invalid cron expression "${expression}" — falling back to "${DEFAULT_CRON}"`);
    expression = DEFAULT_CRON;
  }

  scheduledTask = makeTask(expression);
  scheduledTask.start();
  currentExpression = expression;
  console.log(`${LOG} cron registered with expression: ${expression} (timezone: ${TIMEZONE})`);
}

function unscheduleAll() {
  if (scheduledTask) {
    try {
      scheduledTask.stop();
    } catch (err) {
      console.error(`${LOG} stop error`, err);
    }
    scheduledTask = null;
    currentExpression = null;
    console.log(`${LOG} cron unscheduled`);
  }
}

/**
 * Re-register with a new cron expression. Called from settings update path
 * (Story 32). If `expression` is invalid, keeps the old schedule and logs.
 */
function reschedule(expression) {
  if (!expression) {
    console.warn(`${LOG} reschedule called with empty expression; no change`);
    return false;
  }
  if (!cron.validate(expression)) {
    console.warn(`${LOG} reschedule called with invalid expression "${expression}"; no change`);
    return false;
  }
  if (expression === currentExpression) {
    return true; // no-op
  }
  unscheduleAll();
  scheduledTask = makeTask(expression);
  scheduledTask.start();
  currentExpression = expression;
  console.log(`${LOG} cron rescheduled with expression: ${expression}`);
  return true;
}

function getCurrentExpression() {
  return currentExpression;
}

module.exports = {
  registerCronJobs,
  unscheduleAll,
  reschedule,
  getCurrentExpression
};
