#!/bin/bash

# =============================================================================
# LIMPEZA COMPLETA DIRETA NO DOCKER - SEM ARQUIVOS EXTERNOS
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}============================================================================${NC}"
echo -e "${RED}LIMPEZA COMPLETA DIRETA NO DOCKER - TUDO SERÁ APAGADO${NC}"
echo -e "${RED}============================================================================${NC}"
echo
echo -e "${RED}🚨 ATENÇÃO: ESTE COMANDO APAGARÁ 100% DE TODOS OS DADOS! 🚨${NC}"
echo -e "${RED}🚨 INCLUSIVE O ADMINISTRADOR E TODAS AS CONFIGURAÇÕES! 🚨${NC}"
echo -e "${RED}🚨 O BANCO FICARÁ COMPLETAMENTE VAZIO! 🚨${NC}"
echo
echo -e "${YELLOW}Para confirmar, digite: APAGAR_TUDO${NC}"
echo -e "${YELLOW}Ou pressione Ctrl+C para cancelar${NC}"
echo

read -p "Confirmação: " confirmation

if [ "$confirmation" != "APAGAR_TUDO" ]; then
    echo -e "${RED}❌ Operação cancelada.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}✅ Iniciando apagamento TOTAL...${NC}"
echo

# Comandos SQL diretos para apagar tudo
SQL_COMMANDS="
-- Desabilitar constraints
SET session_replication_role = replica;

-- Apagar todos os dados de todas as tabelas em ordem correta
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;
TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE quotas RESTART IDENTITY CASCADE;
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE admin_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE rate_limit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_config RESTART IDENTITY CASCADE;

-- Reabilitar constraints
SET session_replication_role = DEFAULT;

-- Resetar todas as sequências
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'ALTER SEQUENCE ' || r.sequence_name || ' RESTART WITH 1';
    END LOOP;
END
\$\$;

-- Verificar que tudo está vazio (TODAS as tabelas)
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'quotas' as table_name, COUNT(*) as count FROM quotas
UNION ALL
SELECT 'loans' as table_name, COUNT(*) as count FROM loans
UNION ALL
SELECT 'loan_installments' as table_name, COUNT(*) as count FROM loan_installments
UNION ALL
SELECT 'transactions' as table_name, COUNT(*) as count FROM transactions
UNION ALL
SELECT 'withdrawals' as table_name, COUNT(*) as count FROM withdrawals
UNION ALL
SELECT 'app_settings' as table_name, COUNT(*) as count FROM app_settings
UNION ALL
SELECT 'admin_logs' as table_name, COUNT(*) as count FROM admin_logs
UNION ALL
SELECT 'audit_logs' as table_name, COUNT(*) as count FROM audit_logs
UNION ALL
SELECT 'rate_limit_logs' as table_name, COUNT(*) as count FROM rate_limit_logs
UNION ALL
SELECT 'system_config' as table_name, COUNT(*) as count FROM system_config;
"

# Executar os comandos diretamente no Docker
echo -e "${YELLOW}🔸 Executando limpeza completa...${NC}"
if docker exec -i cred30-postgres psql -U cred30user -d cred30 <<< "$SQL_COMMANDS"; then
    echo
    echo -e "${GREEN}✅ LIMPEZA COMPLETA REALIZADA COM SUCESSO!${NC}"
    echo
    echo -e "${RED}🎯 RESULTADO:${NC}"
    echo -e "${RED}✅ BANCO 100% VAZIO${NC}"
    echo -e "${RED}✅ TODOS OS DADOS APAGADOS${NC}"
    echo -e "${RED}✅ SISTEMA PRECISA SER REINICIALIZADO${NC}"
    echo
    echo -e "${BLUE}🔄 PRÓXIMOS PASSOS:${NC}"
    echo -e "${YELLOW}1. Para recriar o banco:${NC}"
    echo -e "${GREEN}   docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql${NC}"
    echo -e "${YELLOW}2. Acesse a aplicação e crie o primeiro admin${NC}"
    echo
else
    echo -e "${RED}❌ Falha na execução da limpeza!${NC}"
    exit 1
fi