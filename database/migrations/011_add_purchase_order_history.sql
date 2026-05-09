-- Migration: Add Purchase Order History (audit table)
-- Epic: EPIC-07 Manual Purchase Orders + Email
-- Story: STORY-25 Receive PO + Stock Increment
-- Created: 2026-05-09
--
-- Lightweight insert-only history table for tracking PO lifecycle events.
-- Forward-only, idempotent.

CREATE TABLE IF NOT EXISTS purchase_order_history (
  history_id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  event_type ENUM('created','sent','received','partially_received','cancelled','edited') NOT NULL,
  details JSON NULL,
  actor_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_po_history_po (po_id),
  CONSTRAINT fk_po_history_po FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
  CONSTRAINT fk_po_history_user FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE purchase_order_history COMMENT = 'Audit trail for PO lifecycle events: created, sent, received, partially_received, cancelled, edited.';