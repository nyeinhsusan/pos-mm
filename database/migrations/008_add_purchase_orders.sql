-- Migration: Add Purchase Orders + Line Items
-- Epic: EPIC-07 Manual Purchase Orders + Email
-- Story: STORY-22 PO Data Model + Email Infrastructure
-- Created: 2026-05-07

CREATE TABLE IF NOT EXISTS purchase_orders (
  po_id INT PRIMARY KEY AUTO_INCREMENT,
  po_number VARCHAR(20) NOT NULL UNIQUE,
  vendor_id INT NOT NULL,
  status ENUM('draft', 'sent', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
  source ENUM('manual', 'auto_ml') NOT NULL DEFAULT 'manual',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  pdf_url VARCHAR(512) NULL,
  created_by_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  received_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  cancellation_reason VARCHAR(500) NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  INDEX idx_purchase_orders_status (status),
  INDEX idx_purchase_orders_vendor (vendor_id),
  INDEX idx_purchase_orders_created_at (created_at),
  CONSTRAINT chk_po_amounts_nonnegative CHECK (subtotal >= 0 AND tax_amount >= 0 AND total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  po_item_id INT PRIMARY KEY AUTO_INCREMENT,
  po_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_ordered INT NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12, 2) NOT NULL,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
  INDEX idx_po_items_po (po_id),
  INDEX idx_po_items_product (product_id),
  CONSTRAINT chk_po_item_qty_positive CHECK (quantity_ordered >= 1),
  CONSTRAINT chk_po_item_received_nonneg CHECK (quantity_received >= 0),
  CONSTRAINT chk_po_item_received_le_ordered CHECK (quantity_received <= quantity_ordered),
  CONSTRAINT chk_po_item_unit_cost_nonneg CHECK (unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE purchase_orders COMMENT = 'Purchase orders raised against vendors. PO numbers are PO-YYYY-NNNN, sequence assigned in app code (yearly reset).';
ALTER TABLE purchase_order_items COMMENT = 'PO line items. quantity_received <= quantity_ordered enforced at DB level.';
