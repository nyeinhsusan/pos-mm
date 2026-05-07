-- DEV / DEMO ONLY -- do not run against production
--
-- Seeds one example vendor and links them to two existing seed products.
-- Assumes products id=1 (Coca-Cola 500ml) and id=3 (White Rice 5kg) exist
-- (per the existing seed data referenced in story-18 AC #10).
--
-- Safe to re-run: uses INSERT IGNORE; vendor_products UNIQUE (vendor_id, product_id)
-- prevents duplicate links.

INSERT IGNORE INTO vendors
  (vendor_id, name, contact_name, email, phone, payment_terms, lead_time_days)
VALUES
  (1, 'ACME Distribution Co.', 'U Aung', 'sales@acme-dist.example.com', '+95 9 123 456 789', 'NET_15', 5);

INSERT IGNORE INTO vendor_products
  (vendor_id, product_id, vendor_cost_price, default_reorder_qty, min_order_qty, is_preferred)
VALUES
  (1, 1, 950.00, 24, 12, TRUE),
  (1, 3, 5800.00, 10, 5, FALSE);
