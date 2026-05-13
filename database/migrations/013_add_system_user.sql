-- Migration: Add system user for auto-generated POs
-- Epic: EPIC-09 ML Auto-Reorder Engine
-- Story: STORY-31 Auto-Draft PO from ML Triggers
-- Created: 2026-05-13
--
-- Auto-generated POs need a valid `created_by_user_id` (FK to users). This
-- seed creates a single "system" user that cannot log in (password_hash is a
-- sentinel that fails bcrypt comparison). The user is shown as the actor on
-- audit rows for auto-generated POs.
--
-- Idempotent via INSERT IGNORE on a unique email.

INSERT IGNORE INTO users (email, password_hash, full_name, role)
VALUES ('system@auto.local', '!disabled!', 'System (Auto-Reorder)', 'owner');
