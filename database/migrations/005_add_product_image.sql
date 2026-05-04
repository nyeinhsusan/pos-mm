-- Migration: Add Image Field to Products Table
-- Epic: Epic 1 - Image Infrastructure
-- Story: 1.1 Database Schema Update - Add Image Field
-- Created: 2026-05-03

-- Add image column to products table
ALTER TABLE products ADD COLUMN image VARCHAR(500) DEFAULT NULL AFTER description;

-- Add index for image column (for faster queries)
ALTER TABLE products ADD INDEX idx_image (image);

-- Add comment to describe the column
ALTER TABLE products MODIFY COLUMN image VARCHAR(500) DEFAULT NULL COMMENT 'Product image URL or file path';