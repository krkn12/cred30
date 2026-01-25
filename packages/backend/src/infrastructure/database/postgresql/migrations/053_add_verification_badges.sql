
-- Adicionar flags de verificação (Selo) para Lojistas e Entregadores
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_courier BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN users.is_verified_seller IS 'Possui o Selo de Lojista Verificado (Taxa 12%)';
COMMENT ON COLUMN users.is_verified_courier IS 'Possui o Selo de Entregador Verificado (Taxa 10%)';
