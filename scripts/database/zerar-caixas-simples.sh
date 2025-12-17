#!/bin/bash

echo "🔸 Zerando caixa operacional e caixa fundo..."

docker exec -i cred30-postgres psql -U cred30user -d cred30 << 'EOF'
-- Verificar valores atuais
SELECT 'ANTES DO ZERAMENTO:' as info, key, value::text as valor 
FROM app_settings 
WHERE key IN ('operational_cash_balance', 'reserve_fund_balance')
ORDER BY key;

-- Zerar caixa operacional
UPDATE app_settings SET value = '0', updated_at = NOW() WHERE key = 'operational_cash_balance';

-- Zerar caixa fundo
UPDATE app_settings SET value = '0', updated_at = NOW() WHERE key = 'reserve_fund_balance';

-- Verificar novos valores
SELECT 'DEPOIS DO ZERAMENTO:' as info, key, value::text as valor 
FROM app_settings 
WHERE key IN ('operational_cash_balance', 'reserve_fund_balance')
ORDER BY key;
EOF

echo "✅ Caixas zerados com sucesso!"
echo "📋 Atualize a página do admin para ver R$ 0,00 em ambos os caixas"