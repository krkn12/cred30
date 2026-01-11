-- Migration: Add courier registration system
-- This enables users to register as delivery couriers with vehicle information

-- 1. Add courier fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_courier BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_vehicle VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_cpf VARCHAR(14) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_city VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_state VARCHAR(2) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_created_at TIMESTAMP DEFAULT NULL;

-- 2. Add indexes for courier queries
CREATE INDEX IF NOT EXISTS idx_users_is_courier ON users(is_courier) WHERE is_courier = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_courier_vehicle ON users(courier_vehicle) WHERE is_courier = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_courier_status ON users(courier_status);

-- 3. Comments for documentation
COMMENT ON COLUMN users.is_courier IS 'Whether user is registered as a courier';
COMMENT ON COLUMN users.courier_status IS 'Courier status: pending, approved, rejected';
COMMENT ON COLUMN users.courier_vehicle IS 'Type of vehicle: BIKE, MOTO, CAR, TRUCK';
COMMENT ON COLUMN users.courier_phone IS 'Contact phone for delivery coordination';
COMMENT ON COLUMN users.courier_cpf IS 'CPF for courier verification';
COMMENT ON COLUMN users.courier_city IS 'City where courier operates';
COMMENT ON COLUMN users.courier_state IS 'State where courier operates (UF)';
COMMENT ON COLUMN users.courier_created_at IS 'Timestamp when courier registered';
