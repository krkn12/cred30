-- Corrigir tabela transactions para adicionar campo updated_at
-- Este script resolve o erro: "record "new" has no field "updated_at"

-- Adicionar campo updated_at à tabela transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at antes de UPDATE
DROP TRIGGER IF EXISTS update_transactions_updated_at_trigger ON transactions;
CREATE TRIGGER update_transactions_updated_at_trigger
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- Verificar se a correção foi aplicada
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name = 'updated_at';