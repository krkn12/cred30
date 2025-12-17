#!/bin/bash

# =============================================================================
-- ZERAR CAIXA OPERACIONAL E CAIXA FUNDO
-- =============================================================================
-- Este script zera o caixa operacional e o caixa fundo
-- Mantém todos os outros dados intactos
-- =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}ZERAR CAIXA OPERACIONAL E CAIXA FUNDO${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo
echo -e "${YELLOW}⚠️ ATENÇÃO: Este script irá ZERAR os caixas!${NC}"
echo -e "${YELLOW}⚠️ Caixa Operacional: será zerado${NC}"
echo -e "${YELLOW}⚠️ Caixa Fundo: será zerado${NC}"
echo -e "${GREEN}✅ Todos os outros dados serão mantidos intactos${NC}"
echo
echo -e "${YELLOW}Para confirmar, digite: ZERAR_CAIXAS${NC}"
echo -e "${YELLOW}Ou pressione Ctrl+C para cancelar${NC}"
echo

read -p "Confirmação: " confirmation

if [ "$confirmation" != "ZERAR_CAIXAS" ]; then
    echo -e "${RED}❌ Operação cancelada.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}✅ Iniciando zeramento dos caixas...${NC}"
echo

# Comandos SQL para zerar caixa operacional e caixa fundo
SQL_COMMANDS="
BEGIN;

-- Verificar valores atuais
SELECT 'CAIXA OPERACIONAL ANTES:' as info, key, value::text as valor 
FROM app_settings 
WHERE key IN ('operational_cash_balance', 'reserve_fund_balance')
ORDER BY key;

-- Zerar caixa operacional
UPDATE app_settings 
SET value = '0', updated_at = NOW() 
WHERE key = 'operational_cash_balance';

-- Zerar caixa fundo
UPDATE app_settings 
SET value = '0', updated_at = NOW() 
WHERE key = 'reserve_fund_balance';

-- Verificar novos valores
SELECT 'CAIXAS DEPOIS DO ZERAMENTO:' as info, key, value::text as valor 
FROM app_settings 
WHERE key IN ('operational_cash_balance', 'reserve_fund_balance')
ORDER BY key;

-- Registrar operação de zeramento no log
INSERT INTO admin_logs (admin_id, entity_type, entity_id, action, old_value, new_value, created_at)
SELECT 
    u.id,
    'app_settings',
    (SELECT id FROM app_settings WHERE key = 'operational_cash_balance'),
    'CAIXAS_ZERADOS',
    'operational_cash_balance=valor_antigo, reserve_fund_balance=valor_antigo',
    'operational_cash_balance=0, reserve_fund_balance=0',
    NOW()
FROM users u 
WHERE u.email = 'josiassm701@gmail.com'
LIMIT 1;

COMMIT;

-- Verificação final
SELECT 'VERIFICAÇÃO FINAL:' as status, key, value::text as valor, updated_at
FROM app_settings 
WHERE key IN ('operational_cash_balance', 'reserve_fund_balance')
ORDER BY key;
"

# Executar os comandos diretamente no Docker
echo -e "${YELLOW}🔸 Executando zeramento dos caixas...${NC}"
if docker exec -i cred30-postgres psql -U cred30user -d cred30 <<< "$SQL_COMMANDS"; then
    echo
    echo -e "${GREEN}✅ CAIXAS ZERADOS COM SUCESSO!${NC}"
    echo
    echo -e "${GREEN}🎯 RESULTADO:${NC}"
    echo -e "${GREEN}✅ Caixa Operacional: R$ 0,00${NC}"
    echo -e "${GREEN}✅ Caixa Fundo: R$ 0,00${NC}"
    echo -e "${GREEN}✅ Operação registrada no log${NC}"
    echo -e "${GREEN}✅ Demais dados mantidos intactos${NC}"
    echo
    echo -e "${BLUE}📋 Próximos passos:${NC}"
    echo -e "${YELLOW}1. Atualize a página do admin${NC}"
    echo -e "${YELLOW}2. Verifique que ambos os caixas mostram R$ 0,00${NC}"
    echo -e "${YELLOW}3. O sistema continua funcionando normalmente${NC}"
    echo
else
    echo -e "${RED}❌ Falha no zeramento dos caixas!${NC}"
    exit 1
fi