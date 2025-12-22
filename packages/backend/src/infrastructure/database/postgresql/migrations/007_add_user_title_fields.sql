-- Adicionar campos para controle de download de título de sócio majoritário
ALTER TABLE users ADD COLUMN IF NOT EXISTS title_downloaded BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title_downloaded_at TIMESTAMP;
