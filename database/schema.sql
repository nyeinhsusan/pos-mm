-- POS Myanmar Database Schema
-- MySQL 8.0+

-- Drop existing database if exists (USE WITH CAUTION!)
-- DROP DATABASE IF EXISTS pos_myanmar;

-- Create database
CREATE DATABASE IF NOT EXISTS pos_myanmar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pos_myanmar;

-- Users Table (Owners and Cashiers)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('owner', 'cashier') NOT NULL DEFAULT 'cashier',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products Table (with ML support fields)
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 10,
    sku VARCHAR(100) UNIQUE,
    description TEXT,
    last_restock_date DATE,
    restock_frequency INT DEFAULT 30 COMMENT 'Average days between restocks',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_category (category),
    INDEX idx_stock (stock_quantity),
    INDEX idx_created_at (created_at),
    CONSTRAINT chk_price_positive CHECK (price >= 0),
    CONSTRAINT chk_stock_nonnegative CHECK (stock_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales Table (Transaction Header)
CREATE TABLE sales (
    sale_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    profit DECIMAL(10, 2) GENERATED ALWAYS AS (total_amount - total_cost) STORED,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_sale_date (sale_date),
    INDEX idx_user_id (user_id),
    CONSTRAINT chk_total_amount_positive CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sale Items Table (Transaction Line Items)
CREATE TABLE sale_items (
    sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
    INDEX idx_sale_id (sale_id),
    INDEX idx_product_id (product_id),
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments Table (Payment Methods for Sales)
CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    payment_method ENUM('cash', 'card', 'kbzpay', 'wavepay', 'ayapay') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_id VARCHAR(100),
    status ENUM('pending', 'completed', 'failed') DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
    INDEX idx_sale_id (sale_id),
    INDEX idx_payment_method (payment_method),
    INDEX idx_created_at (created_at),
    CONSTRAINT chk_payment_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
