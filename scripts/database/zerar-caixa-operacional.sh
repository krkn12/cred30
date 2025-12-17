#!/bin/bash

# =============================================================================
-- ZERAR CAIXA OPERACIONAL - APENAS O CAIXA
-- =============================================================================
-- Este script zera APENAS o caixa operacional (R$ 1.299,20)
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
echo -e "${BLUE}ZERAR CAIXA OPERACIONAL${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo
echo -e "${YELLOW}⚠️ ATENÇÃO: Este script irá ZERAR o caixa operacional!${NC}"
echo -e "${YELLOW}⚠️ Valor atual: R$ 1.299,20${NC}"
echo -e "${YELLOW}⚠️ Novo valor: R$ 0,00${NC}"
echo -e "${GREEN}✅ Todos os outros dados serão mantidos intactos${NC}"
echo
echo -e "${YELLOW}Para confirmar, digite: ZERAR_CAIXA${NC}"
echo -e "${YELLOW}Ou pressione Ctrl+C para cancelar${NC}"
echo

read -p "Confirmação: " confirmation

if [ "$confirmation" != "ZERAR_CAIXA" ]; then
    echo -e "${RED}❌ Operação cancelada.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}✅ Iniciando zeramento do caixa operacional...${NC}"
echo

# Comandos SQL para zerar apenas o caixa operacional
SQL_COMMANDS="
BEGIN;

-- Verificar valor atual do caixa operacional
SELECT 'CAIXA OPERACIONAL ANTES:' as info, value::text as valor 
FROM app_settings 
WHERE key = 'operational_cash_balance';

-- Zerar o caixa operacional
UPDATE app_settings 
SET value = '0', updated_at = NOW() 
WHERE key = 'operational_cash_balance';

-- Verificar novo valor
SELECT 'CAIXA OPERACIONAL DEPOIS:' as info, value::text as valor 
FROM app_settings 
WHERE key = 'operational_cash_balance';

-- Registrar operação de zeramento no log
INSERT INTO admin_logs (admin_id, entity_type, entity_id, action, old_value, new_value, created_at)
SELECT 
    u.id,
    'app_settings',
    (SELECT id FROM app_settings WHERE key = 'operational_cash_balance'),
    'CAIXA_ZERADO',
    '1299.20',
    '0',
    NOW()
FROM users u 
WHERE u.email = 'josiassm701@gmail.com'
LIMIT 1;

COMMIT;

-- Verificação final
SELECT 'VERIFICAÇÃO FINAL:' as status, key, value::text as valor, updated_at
FROM app_settings 
WHERE key = 'operational_cash_balance';
"

# Executar os comandos diretamente no Docker
echo -e "${YELLOW}🔸 Executando zeramento do caixa operacional...${NC}"
if docker exec -i cred30-postgres psql -U cred30user -d cred30 <<< "$SQL_COMMANDS"; then
    echo
    echo -e "${GREEN}✅ CAIXA OPERACIONAL ZERADO COM SUCESSO!${NC}"
    echo
    echo -e "${GREEN}🎯 RESULTADO:${NC}"
    echo -e "${GREEN}✅ Caixa operacional: R$ 0,00${NC}"
    echo -e "${GREEN}✅ Valor anterior: R$ 1.299,20${NC}"
    echo -e "${GREEN}✅ Operação registrada no log${NC}"
    echo -e "${GREEN}✅ Demais dados mantidos intactos${NC}"
    echo
    echo -e "${BLUE}📋 Próximos passos:${NC}"
    echo -e "${YELLOW}1. Atualize a página do admin${NC}"
    echo -e "${YELLOW}2. Verifique que o caixa mostra R$ 0,00${NC}"
    echo -e "${YELLOW}3. O sistema continua funcionando normalmente${NC}"
    echo
else
    echo -e "${RED}❌ Falha no zeramento do caixa operacional!${NC}"
    exit 1
fi