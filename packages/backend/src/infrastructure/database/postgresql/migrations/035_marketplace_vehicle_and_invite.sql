-- Migration: Add vehicle requirements and courier invitation system
-- This enables users to specify what vehicle is needed and invite specific drivers

-- 1. Add vehicle requirement to listings
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS required_vehicle VARCHAR(20) DEFAULT 'MOTO';
-- Categories: 'BIKE', 'MOTO', 'CAR', 'TRUCK'

-- 2. Add invitation system to orders
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS invited_courier_id UUID REFERENCES users(id);

-- 3. Add column to track invitation status in marketplace_orders
-- We will repurpose delivery_status: 'INVITED' will be the new status
-- Current statuses: NONE, AVAILABLE, ACCEPTED, IN_TRANSIT, DELIVERED

-- 4. Comments for documentation
COMMENT ON COLUMN marketplace_listings.required_vehicle IS 'Type of vehicle required for delivery: BIKE, MOTO, CAR, TRUCK';
COMMENT ON COLUMN marketplace_orders.invited_courier_id IS 'ID of a specific user invited by the buyer to perform the delivery';
