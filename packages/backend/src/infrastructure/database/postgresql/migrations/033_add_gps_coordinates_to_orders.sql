-- Migration: Add GPS coordinates to marketplace_orders for logistics map
-- This allows us to display delivery pins on an interactive map without real-time geocoding

-- Add GPS coordinates for pickup location (seller location)
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8);
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8);

-- Add GPS coordinates for delivery location (buyer location)
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 8);
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(11, 8);

-- Add indexes for geo-spatial queries (future optimization for "nearby deliveries")
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_pickup_coords 
  ON marketplace_orders(pickup_lat, pickup_lng) 
  WHERE pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_delivery_coords 
  ON marketplace_orders(delivery_lat, delivery_lng) 
  WHERE delivery_lat IS NOT NULL AND delivery_lng IS NOT NULL;

-- Add comment explaining the precision
COMMENT ON COLUMN marketplace_orders.pickup_lat IS 'Latitude of pickup location (8 decimal places = ~1mm precision)';
COMMENT ON COLUMN marketplace_orders.pickup_lng IS 'Longitude of pickup location (8 decimal places = ~1mm precision)';
COMMENT ON COLUMN marketplace_orders.delivery_lat IS 'Latitude of delivery location (8 decimal places = ~1mm precision)';
COMMENT ON COLUMN marketplace_orders.delivery_lng IS 'Longitude of delivery location (8 decimal places = ~1mm precision)';
