/**
 * PO Number Generator
 * Format: PO-YYYY-NNNN (yearly reset, 4-digit zero-padded sequence).
 *
 * Concurrency safety: must be called inside an active transaction with the
 * `purchase_orders` table row about to be inserted. We take a SELECT ... FOR
 * UPDATE on the latest row of the current year to serialize concurrent creators.
 */

async function nextPoNumber(connection) {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  // Lock the latest row of this year for the duration of the transaction.
  // If no row exists yet this year, the SELECT returns empty — that's fine,
  // there's nothing to lock and the first insert wins.
  const [rows] = await connection.query(
    `SELECT po_number FROM purchase_orders
     WHERE po_number LIKE ?
     ORDER BY po_number DESC
     LIMIT 1
     FOR UPDATE`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const last = rows[0].po_number; // e.g. "PO-2026-0042"
    const tail = last.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      nextSeq = parsed + 1;
    }
  }

  if (nextSeq > 9999) {
    throw new Error('PO number sequence exhausted for the year (>9999).');
  }

  const padded = String(nextSeq).padStart(4, '0');
  return `${prefix}${padded}`;
}

module.exports = { nextPoNumber };
