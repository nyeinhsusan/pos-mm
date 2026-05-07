-- Migration: Add Vendor-Product Catalog Junction Table
-- Epic: EPIC-06 Vendor Directory & Catalog
-- Story: STORY-18 Vendor Data Model & Migrations
-- Created: 2026-05-07
--
-- Mutual-exclusion of is_preferred per product is enforced via a generated
-- column + UNIQUE index (NULLs are not deduplicated by UNIQUE in MySQL,
-- so non-preferred rows do not collide). The "trigger that updates the same
-- table" approach from the story spec is infeasible in MySQL (error 1442 -
-- a trigger cannot modify the table that fired it). The generated-column
-- approach is the alternative listed in the story (AC #6 option 1).
--
-- Trade-off: when an app sets is_preferred=TRUE on a row while another row
-- for the same product is already preferred, the INSERT/UPDATE will fail
-- with ER_DUP_ENTRY. The setPreferred() method in Story 21 must clear the
-- existing preferred row first, then set the new one (use a transaction).
--
-- Note: preferred_lock is VIRTUAL (not STORED) because MySQL forbids
-- ON DELETE CASCADE on a column referenced by a STORED generated column.
-- VIRTUAL is computed at read-time and indexed correctly for UNIQUE.

CREATE TABLE IF NOT EXISTS vendor_products (
  vendor_product_id INT PRIMARY KEY AUTO_INCREMENT,
  vendor_id INT NOT NULL,
  product_id INT NOT NULL,
  vendor_cost_price DECIMAL(12, 2) NOT NULL,
  default_reorder_qty INT NOT NULL DEFAULT 1,
  min_order_qty INT NOT NULL DEFAULT 1,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  -- Generated lock column: 'preferred-{product_id}' when preferred, else NULL.
  -- Combined with UNIQUE index below, enforces at most one preferred per product.
  preferred_lock VARCHAR(40) GENERATED ALWAYS AS
    (IF(is_preferred, CONCAT('preferred-', product_id), NULL)) VIRTUAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  UNIQUE KEY uq_vendor_product (vendor_id, product_id),
  UNIQUE KEY uq_one_preferred_per_product (preferred_lock),
  INDEX idx_vendor_products_product (product_id),
  CONSTRAINT chk_vendor_cost_nonnegative CHECK (vendor_cost_price >= 0),
  CONSTRAINT chk_default_reorder_qty_positive CHECK (default_reorder_qty >= 1),
  CONSTRAINT chk_min_order_qty_positive CHECK (min_order_qty >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE vendor_products COMMENT = 'Per-vendor product catalog with cost, reorder qty, and preferred-vendor flag';
