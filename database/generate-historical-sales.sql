-- Generate 6 months of historical sales data for ML training
-- Run this after schema.sql and seed.sql

USE pos_myanmar;

-- Create a stored procedure to generate random sales
DELIMITER $$

DROP PROCEDURE IF EXISTS GenerateHistoricalSales$$

CREATE PROCEDURE GenerateHistoricalSales()
BEGIN
    DECLARE v_date DATE;
    DECLARE v_end_date DATE;
    DECLARE v_sale_count INT;
    DECLARE v_i INT;
    DECLARE v_user_id INT;
    DECLARE v_product_count INT;
    DECLARE v_product_id INT;
    DECLARE v_quantity INT;
    DECLARE v_unit_price DECIMAL(10,2);
    DECLARE v_unit_cost DECIMAL(10,2);
    DECLARE v_total_amount DECIMAL(10,2);
    DECLARE v_total_cost DECIMAL(10,2);
    DECLARE v_sale_id INT;
    DECLARE v_day_of_week INT;

    -- Date range: 6 months ago to yesterday
    SET v_end_date = CURDATE() - INTERVAL 1 DAY;
    SET v_date = v_end_date - INTERVAL 6 MONTH;

    -- Loop through each day
    WHILE v_date <= v_end_date DO
        SET v_day_of_week = DAYOFWEEK(v_date); -- 1=Sunday, 7=Saturday

        -- Determine number of sales for this day
        -- Weekends: 15-25 sales, Weekdays: 8-15 sales
        IF v_day_of_week IN (1, 7) THEN
            SET v_sale_count = FLOOR(15 + RAND() * 10); -- 15-25
        ELSE
            SET v_sale_count = FLOOR(8 + RAND() * 7);   -- 8-15
        END IF;

        -- Special boost for certain periods (simulate seasonality)
        -- Month-end (25th-31st): +50% sales
        IF DAY(v_date) >= 25 THEN
            SET v_sale_count = FLOOR(v_sale_count * 1.5);
        END IF;

        -- Generate sales for this day
        SET v_i = 1;
        WHILE v_i <= v_sale_count DO
            -- Random cashier (user_id 1=owner, 2=cashier)
            SET v_user_id = IF(RAND() > 0.3, 2, 1); -- 70% cashier, 30% owner

            SET v_total_amount = 0;
            SET v_total_cost = 0;

            -- Insert sale record
            INSERT INTO sales (user_id, total_amount, total_cost, sale_date, notes)
            VALUES (v_user_id, 0, 0,
                    DATE_ADD(v_date, INTERVAL FLOOR(RAND() * 14) HOUR), -- Random hour 0-14
                    'Historical data');

            SET v_sale_id = LAST_INSERT_ID();

            -- Add 1-5 products to this sale
            SET v_product_count = FLOOR(1 + RAND() * 4); -- 1-5 products

            -- Add random products
            WHILE v_product_count > 0 DO
                -- Random product (product_id 1-4)
                SET v_product_id = FLOOR(1 + RAND() * 4);

                -- Random quantity (1-3 for most, 1-10 for groceries)
                IF v_product_id = 3 THEN -- Rice
                    SET v_quantity = FLOOR(1 + RAND() * 3); -- 1-3
                ELSE
                    SET v_quantity = FLOOR(1 + RAND() * 5); -- 1-5
                END IF;

                -- Get product price and cost
                SELECT price, cost_price INTO v_unit_price, v_unit_cost
                FROM products WHERE product_id = v_product_id;

                -- Insert sale item
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost)
                VALUES (v_sale_id, v_product_id, v_quantity, v_unit_price, v_unit_cost);

                -- Update totals
                SET v_total_amount = v_total_amount + (v_unit_price * v_quantity);
                SET v_total_cost = v_total_cost + (v_unit_cost * v_quantity);

                SET v_product_count = v_product_count - 1;
            END WHILE;

            -- Update sale totals
            UPDATE sales
            SET total_amount = v_total_amount, total_cost = v_total_cost
            WHERE sale_id = v_sale_id;

            SET v_i = v_i + 1;
        END WHILE;

        -- Next day
        SET v_date = DATE_ADD(v_date, INTERVAL 1 DAY);
    END WHILE;

END$$

DELIMITER ;

-- Execute the procedure
CALL GenerateHistoricalSales();

-- Verify data generation
SELECT
    DATE_FORMAT(MIN(sale_date), '%Y-%m-%d') as first_sale,
    DATE_FORMAT(MAX(sale_date), '%Y-%m-%d') as last_sale,
    COUNT(*) as total_sales,
    SUM(total_amount) as total_revenue,
    SUM(profit) as total_profit
FROM sales;

SELECT
    YEAR(sale_date) as year,
    MONTH(sale_date) as month,
    COUNT(*) as sales_count,
    SUM(total_amount) as monthly_revenue
FROM sales
GROUP BY YEAR(sale_date), MONTH(sale_date)
ORDER BY year, month;

-- Drop the procedure after use
DROP PROCEDURE IF EXISTS GenerateHistoricalSales;
