# Database — POS Myanmar

MySQL 8+ schema, migrations, and dev seed data.

## Initial setup

```bash
mysql -u root < schema.sql
mysql -u root pos_myanmar < seed.sql
```

## Migrations

Forward-only SQL files in `migrations/`. Apply in numerical order.

| File | Purpose |
|------|---------|
| `003_add_discounts.sql` | Discount tables for Epic 10 |
| `004_add_promotions.sql` | Promotion management |
| `005_add_product_image.sql` | `image` column on `products` |
| `006_add_vendors.sql` | Vendor directory (Epic 6 / Story 18) |
| `007_add_vendor_products.sql` | Vendor↔Product catalog junction (Epic 6 / Story 18) |
| `008_add_purchase_orders.sql` | Purchase orders + line items (Epic 7 / Story 22) |
| `009_add_email_log.sql` | Outbound email audit trail (Epic 7 / Story 22) |
| `010_add_vendor_settings.sql` | Singleton vendor-module config + SMTP creds (Epic 7 / Story 22) |

Apply a single migration:

```bash
mysql -u root pos_myanmar < migrations/006_add_vendors.sql
mysql -u root pos_myanmar < migrations/007_add_vendor_products.sql
```

All migrations use `CREATE TABLE IF NOT EXISTS` and are safe to re-run.

## Dev seeds

| File | Notes |
|------|-------|
| `seed.sql` | Core users / products / sales for dev |
| `seed-vendors.sql` | One example vendor + 2 catalog links. **DEV/DEMO ONLY.** |

```bash
mysql -u root pos_myanmar < seed-vendors.sql
```

## Notes on `vendor_products.is_preferred`

At-most-one preferred vendor per product is enforced via a `VIRTUAL`
generated column `preferred_lock` plus a `UNIQUE` index. Direct
attempts to set a second row's `is_preferred=TRUE` for the same
product are rejected with `ER_DUP_ENTRY` (`1062`).

To swap the preferred vendor, the application must clear the old
preferred row and set the new one inside a single transaction —
the trigger-based approach the story originally proposed is
infeasible in MySQL because a trigger cannot modify the table
that fired it (error 1442). See the migration file header for
the full trade-off discussion.
