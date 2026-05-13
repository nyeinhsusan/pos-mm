-- Migration: Add Vendor Invoices
-- Epic: EPIC-08 Vendor Invoices
-- Story: STORY-27 Vendor Invoice Data Model + Capture
-- Created: 2026-05-13
--
-- Captures invoices received from vendors. Links optionally to a PO (ad-hoc invoices
-- are allowed). Forward-only, idempotent.

CREATE TABLE IF NOT EXISTS vendor_invoices (
  invoice_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL,
  vendor_id INT NOT NULL,
  po_id INT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MMK',
  status ENUM('unpaid','paid','overdue') NOT NULL DEFAULT 'unpaid',
  paid_date DATE NULL,
  payment_method ENUM('cash','bank_transfer','mobile_money','other') NULL,
  payment_reference VARCHAR(255) NULL,
  notes TEXT NULL,
  attachment_url VARCHAR(512) NULL,
  created_by_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vendor_invoices_vendor (vendor_id),
  INDEX idx_vendor_invoices_po (po_id),
  INDEX idx_vendor_invoices_status (status),
  INDEX idx_vendor_invoices_invoice_date (invoice_date),
  UNIQUE KEY uk_vendor_invoice_number (vendor_id, invoice_number),
  CONSTRAINT chk_invoice_total_nonneg CHECK (total >= 0 AND subtotal >= 0 AND tax_amount >= 0),
  CONSTRAINT fk_invoice_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
  CONSTRAINT fk_invoice_po FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_user FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE vendor_invoices COMMENT = 'Vendor invoices: optionally linked to a PO, with optional attachment, payment tracking, and unpaid/paid/overdue status. Overdue is computed lazily, not stored.';
