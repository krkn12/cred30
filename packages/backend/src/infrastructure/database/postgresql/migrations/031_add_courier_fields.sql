-- Migration: Add courier vehicle information fields and is_courier flag
-- To allow identification of couriers by buyers and sellers

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_courier BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS courier_vehicle_type VARCHAR(50), -- BICYCLE, MOTORCYCLE, CAR, VAN, TRUCK
ADD COLUMN IF NOT EXISTS courier_vehicle_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS courier_vehicle_plate VARCHAR(20),
ADD COLUMN IF NOT EXISTS courier_photo_url TEXT;

-- Index for faster courier filtering
CREATE INDEX IF NOT EXISTS idx_users_is_courier ON users(is_courier) WHERE is_courier = TRUE;

-- Comments
COMMENT ON COLUMN users.is_courier IS 'Whether user is a registered delivery partner';
COMMENT ON COLUMN users.courier_vehicle_type IS 'Type of vehicle used for deliveries';
COMMENT ON COLUMN users.courier_vehicle_model IS 'Model and color of the vehicle';
COMMENT ON COLUMN users.courier_vehicle_plate IS 'Vehicle license plate for identification';
COMMENT ON COLUMN users.courier_photo_url IS 'URL for driver profile photo';
