-- Migration: Add delivery confirmation code to marketplace orders
-- This code must be provided by the buyer to the courier to confirm delivery

ALTER TABLE marketplace_orders 
ADD COLUMN IF NOT EXISTS delivery_confirmation_code VARCHAR(10);

-- Comment
COMMENT ON COLUMN marketplace_orders.delivery_confirmation_code IS 'Secure code held by buyer to confirm successful receipt of delivery';
