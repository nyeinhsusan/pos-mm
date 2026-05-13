-- Migration: Add ml_confidence to purchase_order_items
-- Epic: EPIC-09 ML Auto-Reorder Engine
-- Story: STORY-33 Manual Run Now + Activity Log
-- Created: 2026-05-13
--
-- Stores per-line-item ML prediction confidence for low-confidence flagging in UI.
-- Nullable — existing auto-POs created before this migration have NULL.

ALTER TABLE purchase_order_items
  ADD COLUMN ml_confidence DECIMAL(3, 2) NULL
  AFTER line_total;

ALTER TABLE purchase_order_items COMMENT = 'PO line items with optional ML confidence score for auto-generated POs.';