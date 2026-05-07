-- Migration: Add Email Log
-- Epic: EPIC-07 Manual Purchase Orders + Email
-- Story: STORY-22 PO Data Model + Email Infrastructure
-- Created: 2026-05-07

CREATE TABLE IF NOT EXISTS email_log (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  email_type ENUM('po', 'reminder', 'manual', 'test') NOT NULL,
  related_po_id INT NULL,
  status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_po_id) REFERENCES purchase_orders(po_id) ON DELETE SET NULL,
  INDEX idx_email_log_status (status),
  INDEX idx_email_log_created (created_at),
  INDEX idx_email_log_po (related_po_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE email_log COMMENT = 'Audit trail of every outbound email. Failed sends keep last_error for retry UX.';
