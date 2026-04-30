-- Migration: Add Discount System Tables and Columns
-- Epic: EPIC-10 Discounts & Promotions
-- Story: 10.1 Basic Discount System
-- Created: 2026-04-30

-- Create sale_discounts table
CREATE TABLE IF NOT EXISTS sale_discounts (
  discount_id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  sale_item_id INT NULL,  -- NULL for cart-level discount
  discount_type ENUM('percentage', 'fixed', 'promotion', 'coupon') NOT NULL,
  discount_value DECIMAL(10, 2) NOT NULL,  -- percentage or amount
  discount_amount DECIMAL(10, 2) NOT NULL,  -- actual MMK saved
  reason VARCHAR(255),
  promotion_id INT NULL,  -- if from promotion (future use)
  coupon_code VARCHAR(50) NULL,  -- if from coupon (future use)
  applied_by INT NOT NULL,  -- user_id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
  FOREIGN KEY (applied_by) REFERENCES users(user_id),
  INDEX idx_sale (sale_id),
  INDEX idx_sale_item (sale_item_id),
  INDEX idx_discount_type (discount_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add discount columns to sales table (ignore errors if columns already exist)
ALTER TABLE sales ADD COLUMN total_discount DECIMAL(10, 2) DEFAULT 0 AFTER total_amount;
ALTER TABLE sales ADD COLUMN subtotal_before_discount DECIMAL(10, 2) NULL AFTER total_discount;

-- Add discount columns to sale_items table (for item-level discounts)
ALTER TABLE sale_items ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0 AFTER subtotal;
ALTER TABLE sale_items ADD COLUMN price_before_discount DECIMAL(10, 2) NULL AFTER discount_amount;

-- Create discount_settings table for system-wide discount rules
CREATE TABLE IF NOT EXISTS discount_settings (
  setting_id INT PRIMARY KEY AUTO_INCREMENT,
  max_discount_percentage DECIMAL(5, 2) DEFAULT 50.00,
  max_discount_amount DECIMAL(10, 2) NULL,
  require_approval_threshold DECIMAL(5, 2) DEFAULT 20.00,
  allow_cart_discount BOOLEAN DEFAULT TRUE,
  allow_item_discount BOOLEAN DEFAULT TRUE,
  min_sale_amount_for_discount DECIMAL(10, 2) DEFAULT 0,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default discount settings
INSERT INTO discount_settings (
  max_discount_percentage,
  require_approval_threshold,
  allow_cart_discount,
  allow_item_discount,
  min_sale_amount_for_discount
) VALUES (
  50.00,  -- max 50% discount
  20.00,  -- require approval for >20% discounts
  TRUE,   -- allow cart-level discounts
  TRUE,   -- allow item-level discounts
  0       -- no minimum purchase required for discount
) ON DUPLICATE KEY UPDATE setting_id = setting_id;

-- Add comments to tables
ALTER TABLE sale_discounts COMMENT = 'Stores all discount applications to sales and sale items';
ALTER TABLE discount_settings COMMENT = 'System-wide discount configuration and limits';
