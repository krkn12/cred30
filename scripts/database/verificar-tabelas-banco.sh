#!/bin/bash

# =============================================================================
-- VERIFICAR TODAS AS TABELAS DO BANCO DOCKER
-- =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}VERIFICANDO TODAS AS TABELAS DO BANCO DOCKER${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo

echo -e "${YELLOW}🔸 Verificando container Docker...${NC}"
if ! docker ps | grep -q "cred30-postgres"; then
    echo -e "${RED}❌ Container Docker 'cred30-postgres' não está rodando!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Container Docker encontrado e rodando!${NC}"
echo

echo -e "${YELLOW}🔸 Listando todas as tabelas do banco...${NC}"

# Comando SQL para listar todas as tabelas
SQL_COMMANDS="
SELECT 
    table_name as tabela,
    table_type as tipo
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
"

# Executar e mostrar tabelas
echo -e "${BLUE}📋 TABELAS ENCONTRADAS:${NC}"
docker exec -i cred30-postgres psql -U cred30user -d cred30 <<< "$SQL_COMMANDS"

echo
echo -e "${YELLOW}🔸 Verificando estrutura e dados de cada tabela...${NC}"

# Comando SQL para verificar estrutura e contagem de dados
SQL_CHECK="
SELECT 
    'TABELA: ' || t.table_name as info,
    'REGISTROS: ' || COALESCE(s.n_tup_ins, 0)::text as dados,
    'TIPO: ' || t.table_type as tipo
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
WHERE t.table_schema = 'public' 
ORDER BY t.table_name;
"

echo -e "${BLUE}📊 ESTRUTURA E CONTAGEM DE DADOS:${NC}"
docker exec -i cred30-postgres psql -U cred30user -d cred30 <<< "$SQL_CHECK"

echo
echo -e "${YELLOW}🔸 Verificando tabelas de configurações especiais...${NC}"

# Verificar tabelas específicas que podem não aparecer na lista padrão
SQL_SPECIAL="
SELECT 'system_config' as tabela, COUNT(*) as registros FROM system_config
UNION ALL
SELECT 'app_settings' as tabela, COUNT(*) as registros FROM app_settings
UNION ALL
SELECT 'audit_logs' as tabela, COUNT(*) as registros FROM audit_logs
UNION ALL
SELECT 'admin_logs' as tabela, COUNT(*) as registros FROM admin_logs
UNION ALL
SELECT 'rate_limit_logs' as tabela, COUNT(*) as registros FROM rate_limit_logs
ORDER BY tabela;
"

echo -e "${BLUE}⚙️ TABELAS ESPECIAIS:${NC}"
docker exec -i cred30-postgres psql -U cred30user -d cred30 <<< "$SQL_SPECIAL"

echo
echo -e "${YELLOW}🔸 Verificando sequências...${NC}"

# Verificar todas as sequências
SQL_SEQUENCES="
SELECT 
    sequence_name as sequencia,
    last_value as ultimo_valor,
    start_value as valor_inicial
FROM information_schema.sequences 
WHERE sequence_schema = 'public'
ORDER BY sequence_name;
"

echo -e "${BLUE}🔢 SEQUÊNCIAS:${NC}"
docker exec -i cred30-postgres psql -U cred30user -d cred30 <<< "$SQL_SEQUENCES"

echo
echo -e "${GREEN}✅ Verificação concluída!${NC}"
echo
echo -e "${BLUE}📋 RESUMO PARA LIMPEZA COMPLETA:${NC}"
echo -e "${YELLOW}• Use o script 'wipe-all-docker-direct.sh' para apagar TUDO${NC}"
echo -e "${YELLOW}• Use o script 'zerar-caixas-simples.sh' para zerar apenas caixas${NC}"
echo -e "${YELLOW}• Todas as tabelas foram identificadas e documentadas${NC}"
echo