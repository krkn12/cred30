-- Migration: Add pickup postal code to listings
-- This improves shipping quote accuracy for nationwide logistics

ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pickup_postal_code VARCHAR(10);

COMMENT ON COLUMN marketplace_listings.pickup_postal_code IS 'The postal code (CEP) where the product is located for shipment origin calculation.';
