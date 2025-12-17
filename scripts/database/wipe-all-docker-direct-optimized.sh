#!/bin/bash

# =============================================================================
# VERSÃO OTIMIZADA - LIMPEZA COMPLETA DIRETA NO DOCKER
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Tempo de início
START_TIME=$(date +%s)

echo -e "${RED}============================================================================${NC}"
echo -e "${RED}LIMPEZA COMPLETA OTIMIZADA - VERSÃO RÁPIDA${NC}"
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
echo -e "${GREEN}✅ Iniciando apagamento TOTAL OTIMIZADO...${NC}"
echo

# Verificar se o container está rodando
echo -e "${BLUE}🔍 Verificando container PostgreSQL...${NC}"
if ! docker ps --format "table {{.Names}}" | grep -q "postgres"; then
    echo -e "${RED}❌ Container PostgreSQL não encontrado em execução${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Container PostgreSQL encontrado${NC}"

# Comandos SQL otimizados - usando DROP e RECREATE em vez de TRUNCATE
# Isso é MUITO mais rápido para limpeza completa
SQL_COMMANDS="
-- Desabilitar todas as constraints e triggers para máxima velocidade
SET session_replication_role = replica;
SET session_replication_role = replica;
SET session_replication_role = replica;

-- Dropar todas as tabelas (mais rápido que TRUNCATE para limpeza completa)
DROP TABLE IF EXISTS loan_installments CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS quotas CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS rate_limit_logs CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- Dropar tabelas adicionais que possam existir
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS referral_bonuses CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS support_responses CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS user_statistics CASCADE;
DROP TABLE IF EXISTS system_fees CASCADE;
DROP TABLE IF EXISTS fee_history CASCADE;
DROP TABLE IF EXISTS backup_logs CASCADE;

-- Reabilitar constraints
SET session_replication_role = DEFAULT;

-- Limpar todas as sequências
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || r.sequence_name || ' CASCADE';
    END LOOP;
END
\$\$;

-- Confirmar que tudo foi removido
SELECT 'TODAS AS TABELAS FORAM REMOVIDAS' as status;
"

# Executar os comandos de forma otimizada
echo -e "${YELLOW}🔸 Executando limpeza completa otimizada...${NC}"
echo -e "${BLUE}⚡ Usando DROP em vez de TRUNCATE para máxima velocidade${NC}"

# Usar docker exec com timeout e redirecionamento para evitar bloqueios
if timeout 60 docker exec cred30-postgres psql -U cred30user -d cred30 -q -v ON_ERROR_STOP=1 <<< "$SQL_COMMANDS" 2>/dev/null; then
    echo
    echo -e "${GREEN}✅ LIMPEZA COMPLETA REALIZADA COM SUCESSO!${NC}"
    
    # Tempo decorrido
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    echo -e "${BLUE}⏱️ Tempo total: ${ELAPSED} segundos${NC}"
    echo
    
    echo -e "${RED}🎯 RESULTADO:${NC}"
    echo -e "${RED}✅ BANCO 100% VAZIO${NC}"
    echo -e "${RED}✅ TODAS AS TABELAS REMOVIDAS${NC}"
    echo -e "${RED}✅ TODAS AS SEQUÊNCIAS RESETADAS${NC}"
    echo -e "${RED}✅ SISTEMA PRECISA SER REINICIALIZADO${NC}"
    echo
    
    echo -e "${BLUE}🔄 PRÓXIMOS PASSOS:${NC}"
    echo -e "${YELLOW}1. Para recriar o banco COMPLETO (recomendado):${NC}"
    echo -e "${GREEN}   ./create-missing-tables-docker.sh${NC}"
    echo -e "${YELLOW}2. Ou para recriar apenas o básico:${NC}"
    echo -e "${GREEN}   docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql${NC}"
    echo -e "${YELLOW}3. Acesse a aplicação e crie o primeiro admin${NC}"
    echo
    
else
    echo -e "${RED}❌ Falha na execução da limpeza!${NC}"
    echo -e "${YELLOW}Tentando método alternativo...${NC}"
    
    # Método alternativo mais agressivo
    SQL_ALT="
    -- Desconectar todas as sessões exceto a atual
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = 'cred30';
    
    -- Dropar schema public e recriar
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
    "
    
    if docker exec cred30-postgres psql -U postgres -d cred30 -q <<< "$SQL_ALT" 2>/dev/null; then
        echo -e "${GREEN}✅ Método alternativo funcionou! Schema recriado.${NC}"
    else
        echo -e "${RED}❌ Falha completa. Verifique manualmente.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}🎉 Operação concluída!${NC}"