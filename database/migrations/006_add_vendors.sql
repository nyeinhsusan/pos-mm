-- Migration: Add Vendor Management Tables
-- Epic: EPIC-06 Vendor Directory & Catalog
-- Story: STORY-18 Vendor Data Model & Migrations
-- Created: 2026-05-07

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  vendor_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  address TEXT NULL,
  payment_terms ENUM('NET_7', 'NET_15', 'NET_30', 'COD', 'PREPAID') NOT NULL DEFAULT 'NET_15',
  lead_time_days INT NOT NULL DEFAULT 7,
  currency CHAR(3) NOT NULL DEFAULT 'MMK',
  logo_url VARCHAR(512) NULL,
  notes TEXT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vendors_email (email),
  INDEX idx_vendors_status (status),
  INDEX idx_vendors_name (name),
  CONSTRAINT chk_lead_time_nonnegative CHECK (lead_time_days >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE vendors COMMENT = 'Supplier records for purchase orders and ML auto-reorder';
