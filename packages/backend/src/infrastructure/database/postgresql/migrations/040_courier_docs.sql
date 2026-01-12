-- Migration: Add courier documentation fields
-- Adds columns for ID photo, Vehicle photo, and Document photo

ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_id_photo TEXT; -- RG or CNH photo
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_vehicle_photo TEXT; -- Photo of the vehicle
ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_doc_photo TEXT; -- Vehicle doc or Bike Invoice

COMMENT ON COLUMN users.courier_id_photo IS 'Base64 or URL of the ID photo (RG/CNH)';
COMMENT ON COLUMN users.courier_vehicle_photo IS 'Base64 or URL of the vehicle photo';
COMMENT ON COLUMN users.courier_doc_photo IS 'Base64 or URL of the vehicle document or bike invoice';
