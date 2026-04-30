-- Migration: Add Promotion Management System Tables
-- Epic: EPIC-10 Discounts & Promotions
-- Story: 10.2 Promotion Management System
-- Created: 2026-04-30

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  promotion_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  discount_type ENUM('percentage', 'fixed', 'bogo', 'bundle') NOT NULL,
  discount_value DECIMAL(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME DEFAULT '00:00:00',
  end_time TIME DEFAULT '23:59:59',
  applies_to ENUM('all', 'products', 'categories') NOT NULL DEFAULT 'all',
  min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
  max_discount_amount DECIMAL(10, 2) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_active (is_active),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_applies_to (applies_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create promotion_products table (for product-specific promotions)
CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id INT NOT NULL,
  product_id INT NOT NULL,
  PRIMARY KEY (promotion_id, product_id),
  FOREIGN KEY (promotion_id) REFERENCES promotions(promotion_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create promotion_categories table (for category-wide promotions)
CREATE TABLE IF NOT EXISTS promotion_categories (
  promotion_id INT NOT NULL,
  category VARCHAR(100) NOT NULL,
  PRIMARY KEY (promotion_id, category),
  FOREIGN KEY (promotion_id) REFERENCES promotions(promotion_id) ON DELETE CASCADE,
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update sale_discounts to support promotion_id (column already exists from 003 migration)
-- Add foreign key constraint for promotion_id
ALTER TABLE sale_discounts ADD CONSTRAINT fk_sale_discount_promotion
  FOREIGN KEY (promotion_id) REFERENCES promotions(promotion_id) ON DELETE SET NULL;

-- Add comments
ALTER TABLE promotions COMMENT = 'Stores promotional campaigns with date/time scheduling';
ALTER TABLE promotion_products COMMENT = 'Links promotions to specific products';
ALTER TABLE promotion_categories COMMENT = 'Links promotions to product categories';
