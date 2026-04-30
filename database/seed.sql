-- Seed Data for POS Myanmar
-- Creates initial owner and cashier accounts for testing

USE pos_myanmar;

-- Create owner account
-- Email: owner@pos.com
-- Password: owner123
-- Password hash generated with bcrypt rounds=10
INSERT INTO users (email, password_hash, full_name, role) VALUES
('owner@pos.com', '$2b$10$yw5wQUKmVAPkZlNprZMYHugjoPjIBb1/P2ezaQlRapD1rG3KEIXb6', 'Shop Owner', 'owner');

-- Create cashier account
-- Email: cashier@pos.com
-- Password: cashier123
INSERT INTO users (email, password_hash, full_name, role) VALUES
('cashier@pos.com', '$2b$10$uPz6EfTnJAf80G6zsk6Au.KLDujr4z6NyDXMN5L/u0Ye9bf3lnKzm', 'Cashier User', 'cashier');

-- Create default store configuration
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
) VALUES (
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

-- Verify insertions
SELECT user_id, email, full_name, role, created_at FROM users;
SELECT * FROM store_config;

-- Note: To create these password hashes, you can use Node.js:
-- const bcrypt = require('bcrypt');
-- bcrypt.hash('owner123', 10).then(hash => console.log(hash));
