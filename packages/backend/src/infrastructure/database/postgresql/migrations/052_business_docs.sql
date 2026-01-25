
-- Adicionar campo para documento da empresa (Contrato Social, CCMEI)
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_license_path TEXT;
COMMENT ON COLUMN users.business_license_path IS 'Caminho seguro do Contrato Social ou Certificado MEI';
