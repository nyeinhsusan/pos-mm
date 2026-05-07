-- Migration: Add Vendor Settings (singleton config table)
-- Epic: EPIC-07 Manual Purchase Orders + Email
-- Story: STORY-22 PO Data Model + Email Infrastructure
-- Created: 2026-05-07
--
-- Singleton row enforced via PRIMARY KEY DEFAULT 1 + CHECK (id = 1).
-- INSERT IGNORE at the bottom guarantees the row exists post-migration.

CREATE TABLE IF NOT EXISTS vendor_settings (
  id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  auto_reorder_mode ENUM('disabled', 'approve_first', 'auto_send') NOT NULL DEFAULT 'approve_first',
  auto_reorder_cron VARCHAR(50) NOT NULL DEFAULT '0 2 * * *',
  lead_time_buffer_days INT NOT NULL DEFAULT 2,
  digest_email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  from_display_name VARCHAR(255) NULL,
  reply_to_email VARCHAR(255) NULL,
  smtp_host VARCHAR(255) NULL DEFAULT 'smtp.gmail.com',
  smtp_port INT NULL DEFAULT 465,
  smtp_username VARCHAR(255) NULL,
  smtp_password_encrypted VARBINARY(1024) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_vendor_settings_singleton CHECK (id = 1),
  CONSTRAINT chk_lead_time_buffer_nonneg CHECK (lead_time_buffer_days >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO vendor_settings (id) VALUES (1);

ALTER TABLE vendor_settings COMMENT = 'Singleton config for vendor module: auto-reorder mode, cron, SMTP. smtp_password_encrypted is AES-256-GCM ciphertext (12B IV || 16B tag || ciphertext).';
