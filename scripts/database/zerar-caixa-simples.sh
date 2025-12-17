#!/bin/bash

echo "🔸 Zerando caixa operacional..."

docker exec -i cred30-postgres psql -U cred30user -d cred30 << 'EOF'
-- Zerar caixa operacional
UPDATE app_settings SET value = '0', updated_at = NOW() WHERE key = 'operational_cash_balance';

-- Verificar novo valor
SELECT 'Caixa Operacional ZERADO:' as status, value::text as valor FROM app_settings WHERE key = 'operational_cash_balance';
EOF

echo "✅ Caixa operacional zerado com sucesso!"
echo "📋 Atualize a página do admin para ver R$ 0,00"