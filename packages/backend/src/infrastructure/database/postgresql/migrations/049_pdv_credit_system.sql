-- Migration: PDV Credit System
-- Adiciona suporte a parcelamento via crédito no PDV

-- Adicionar colunas para vincular cobranças a empréstimos
ALTER TABLE pdv_charges ADD COLUMN IF NOT EXISTS loan_id INTEGER REFERENCES loans(id);
ALTER TABLE pdv_charges ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'BALANCE';
ALTER TABLE pdv_charges ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE pdv_charges ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,4) DEFAULT 0;
ALTER TABLE pdv_charges ADD COLUMN IF NOT EXISTS total_with_interest DECIMAL(12,2);
ALTER TABLE pdv_charges ADD COLUMN IF NOT EXISTS guarantee_percentage INTEGER DEFAULT 100;

-- Índice para busca por empréstimo
CREATE INDEX IF NOT EXISTS idx_pdv_charges_loan_id ON pdv_charges(loan_id);

COMMENT ON COLUMN pdv_charges.loan_id IS 'ID do empréstimo criado para cobranças parceladas';
COMMENT ON COLUMN pdv_charges.payment_type IS 'BALANCE (saldo) ou CREDIT (parcelado)';
COMMENT ON COLUMN pdv_charges.installments IS 'Número de parcelas (1 = à vista)';
COMMENT ON COLUMN pdv_charges.interest_rate IS 'Taxa de juros aplicada (0.10 a 0.35)';
COMMENT ON COLUMN pdv_charges.total_with_interest IS 'Valor total que o cliente pagará (com juros)';
COMMENT ON COLUMN pdv_charges.guarantee_percentage IS 'Percentual de garantia usado (50-100)';
