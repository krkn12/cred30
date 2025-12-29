-- Migration: Add daily_chests_opened and last_chest_date columns to users table
-- For tracking daily chest rewards limit (3 per day)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS daily_chests_opened INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_chest_date DATE;

COMMENT ON COLUMN users.daily_chests_opened IS 'Number of reward chests opened today';
COMMENT ON COLUMN users.last_chest_date IS 'Date of last chest opening for daily reset';
