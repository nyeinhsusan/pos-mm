-- Migration script to add receipt functionality to existing database
-- Run this if you already have the database created

USE pos_myanmar;

-- Add receipt columns to sales table if they don't exist
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS receipt_printed_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS receipt_printed_at TIMESTAMP NULL,
ADD INDEX IF NOT EXISTS idx_receipt_number (receipt_number);

-- Create store_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS store_config (
    config_id INT AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(200) NOT NULL DEFAULT 'POS Store',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    tax_rate DECIMAL(5, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'MMK',
    receipt_header TEXT,
    receipt_footer TEXT DEFAULT 'Thank you for your purchase!',
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default store config if table is empty
INSERT INTO store_config (
    store_name,
    address,
    phone,
    email,
    tax_rate,
    currency,
    receipt_header,
    receipt_footer,
    logo_url
)
SELECT * FROM (
    SELECT
        'POS Myanmar Store' as store_name,
        'University of Roehampton\nFinal Year Project Demo' as address,
        '+95 9 123 456 789' as phone,
        'info@posmyanmar.com' as email,
        0.00 as tax_rate,
        'MMK' as currency,
        'Welcome to POS Myanmar!' as receipt_header,
        'Thank you for your purchase!\nPlease come again!' as receipt_footer,
        '/assets/logo.png' as logo_url
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM store_config LIMIT 1);

-- Verify changes
SELECT 'Sales table columns:' as info;
DESCRIBE sales;

SELECT 'Store config:' as info;
SELECT * FROM store_config;
