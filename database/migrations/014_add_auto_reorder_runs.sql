-- Migration: Add auto-reorder run history table
-- Epic: EPIC-09 ML Auto-Reorder Engine
-- Story: STORY-32 Auto-Reorder Settings + Approval Mode
-- Created: 2026-05-13
--
-- One row per cron (or manual) execution of autoReorderService.runAndCreate.
-- Used by /api/auto-reorder/status (last run + counts) and by Story 33's
-- activity log page (full timeline).

CREATE TABLE IF NOT EXISTS auto_reorder_runs (
  run_id INT AUTO_INCREMENT PRIMARY KEY,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  mode VARCHAR(20) NOT NULL,
  status ENUM('running','success','partial_failure','ml_unavailable','disabled','error') NOT NULL DEFAULT 'running',
  triggered_products_count INT UNSIGNED NULL,
  created_pos_count INT UNSIGNED NULL,
  failed_creations_count INT UNSIGNED NULL,
  auto_sent_count INT UNSIGNED NULL,
  auto_send_failed_count INT UNSIGNED NULL,
  error_message TEXT NULL,
  details_json JSON NULL,
  triggered_by ENUM('cron','manual') NOT NULL DEFAULT 'cron',
  actor_user_id INT NULL,
  INDEX idx_arr_started_at (started_at),
  CONSTRAINT fk_arr_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE auto_reorder_runs COMMENT = 'Audit log of auto-reorder cron + manual runs. One row per invocation of autoReorderService.runAndCreate, with full RunCreateResult in details_json.';
