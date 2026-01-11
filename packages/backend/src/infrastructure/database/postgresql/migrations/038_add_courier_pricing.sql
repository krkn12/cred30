-- Migration: Add pricing per KM to couriers
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_price_per_km DECIMAL(10, 2) DEFAULT 2.00;

COMMENT ON COLUMN users.courier_price_per_km IS 'Price per KM defined by the courier for his services';
