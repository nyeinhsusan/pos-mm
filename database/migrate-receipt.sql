-- Migration script for receipt functionality
USE pos_myanmar;

-- Add receipt columns to sales table (ignore errors if they already exist)
ALTER TABLE sales ADD COLUMN receipt_number VARCHAR(50) UNIQUE;
ALTER TABLE sales ADD COLUMN receipt_printed_count INT DEFAULT 0;
ALTER TABLE sales ADD COLUMN receipt_printed_at TIMESTAMP NULL;
ALTER TABLE sales ADD INDEX idx_receipt_number (receipt_number);

-- Create store_config table
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

-- Insert default store config
INSERT IGNORE INTO store_config (
    config_id,
    store_name,
    address,
    phone,
    email,
    tax_rate,
    currency,
    receipt_header,
    receipt_footer,
    logo_url
) VALUES (
    1,
    'POS Myanmar Store',
    'University of Roehampton\nFinal Year Project Demo',
    '+95 9 123 456 789',
    'info@posmyanmar.com',
    0.00,
    'MMK',
    'Welcome to POS Myanmar!',
    'Thank you for your purchase!\nPlease come again!',
    '/assets/logo.png'
);

-- Verify
SELECT 'Migration completed!' as status;
DESCRIBE sales;
SELECT * FROM store_config;
