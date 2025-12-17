#!/bin/bash

# =============================================================================
# APAGAR TUDO DO BANCO - Script para limpeza COMPLETA do banco
# =============================================================================
# ⚠️ ATENÇÃO: ESTE SCRIPT APAGARÁ TODOS OS DADOS DO BANCO!
# =============================================================================

set -e  # Exit on error

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🚨 AVISO EXTREMO! 🚨${NC}"
echo -e "${RED}ESTE SCRIPT APAGARÁ TODOS OS DADOS DO BANCO DE DADOS!${NC}"
echo -e "${RED}NÃO HÁ COMO VOLTAR ATRÁS DISSO!${NC}"
echo
echo -e "${YELLOW}Dados que serão PERMANENTEMENTE APAGADOS:${NC}"
echo -e "${YELLOW}• Todas as transações${NC}"
echo -e "${YELLOW}• Todos os lançamentos${NC}"
echo -e "${YELLOW}• Todos os saldos${NC}"
echo -e "${YELLOW}• Todos os usuários${NC}"
echo -e "${YELLOW}• Toda a auditoria${NC}"
echo -e "${YELLOW}• ABSOLUTAMENTE TUDO!${NC}"
echo

# Confirmação final
echo -e "${YELLOW}Digite 'APAGAR TUDO' para confirmar que quer APAGAR TODOS os dados:${NC}"
echo -e "${YELLOW}Ou pressione Ctrl+C para cancelar${NC}"
echo

# Confirmação direta - mais rápido
echo -e "${YELLOW}Digite 'APAGAR TUDO' para confirmar que quer APAGAR TODOS os dados:${NC}"
echo -e "${YELLOW}Ou pressione Ctrl+C para cancelar${NC}"
echo

if command -v powershell >/dev/null 2>&1; then
    # Windows PowerShell - mais direto
    echo -e "${BLUE}Aguardando entrada (PowerShell)...${NC}"
    CONFIRMATION=$(powershell -Command "Read-Host 'Confirmação:' -NoNewLine")
else
    # Linux/Mac - fallback
    echo -e "${BLUE}Aguardando entrada (Linux/Mac)...${NC}"
    read -p "Digite 'APAGAR TUDO' para confirmar: " CONFIRMATION
fi

echo
if [ "$CONFIRMATION" = "APAGAR TUDO" ]; then
    echo -e "${GREEN}✅ Confirmação recebida: $CONFIRMATION${NC}"
else
    echo -e "${RED}❌ Confirmação incorreta ou cancelada. Operação abortada.${NC}"
    echo -e "${YELLOW}Nenhum dado foi apagado.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Confirmação recebida: $CONFIRMATION${NC}"

echo -e "${RED}🔥 INICIANDO APAGAMENTO COMPLETO DO BANCO...${NC}"
echo

# Carrega variáveis de ambiente
if [ -f "packages/backend/.env" ]; then
    source packages/backend/.env
elif [ -f ".env" ]; then
    source .env
fi

# Configurações do banco
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-cred30}
DB_USER=${DB_USER:-postgres}

echo -e "${BLUE}Conectando ao banco:${NC}"
echo -e "  Host: $DB_HOST"
echo -e "  Porta: $DB_PORT"
echo -e "  Banco: $DB_NAME"
echo -e "  Usuário: $DB_USER"
echo

# Comandos SQL para apagar TUDO
SQL_COMMANDS="
-- Desabilita triggers para evitar erros
SET session_replication_role = replica;

-- Apaga TODAS as tabelas em ordem de dependência
DROP TABLE IF EXISTS auditoria_caixa CASCADE;
DROP TABLE IF EXISTS saldo_diario CASCADE;
DROP TABLE IF EXISTS resumo_caixa CASCADE;
DROP TABLE IF EXISTS operacoes_financeiras CASCADE;
DROP TABLE IF EXISTS lancamentos CASCADE;
DROP TABLE IF EXISTS movimentacoes_caixa CASCADE;
DROP TABLE IF EXISTS transacoes CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS quotas CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Apaga sequências
DROP SEQUENCE IF EXISTS auditoria_caixa_id_seq CASCADE;
DROP SEQUENCE IF EXISTS saldo_diario_id_seq CASCADE;
DROP SEQUENCE IF EXISTS resumo_caixa_id_seq CASCADE;
DROP SEQUENCE IF EXISTS operacoes_financeiras_id_seq CASCADE;
DROP SEQUENCE IF EXISTS lancamentos_id_seq CASCADE;
DROP SEQUENCE IF EXISTS movimentacoes_caixa_id_seq CASCADE;
DROP SEQUENCE IF EXISTS transacoes_id_seq CASCADE;
DROP SEQUENCE IF EXISTS withdrawals_id_seq CASCADE;
DROP SEQUENCE IF EXISTS quotas_id_seq CASCADE;
DROP SEQUENCE IF EXISTS loans_id_seq CASCADE;
DROP SEQUENCE IF EXISTS users_id_seq CASCADE;

-- Apaga tipos customizados (se existir)
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS loan_status CASCADE;
"

echo -e "${YELLOW}Executando comandos de apagamento...${NC}"
echo

# Executa os comandos SQL
if command -v psql; then
    echo "$SQL_COMMANDS" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
    
    if [ $? -eq 0 ]; then
        echo
        echo -e "${GREEN}✅ SUCESSO! Todos os dados do banco foram APAGADOS!${NC}"
        echo -e "${GREEN}🗑️  O banco está agora completamente VAZIO!${NC}"
        echo
        echo -e "${BLUE}Estatísticas finais:${NC}"
        echo -e "${BLUE}• Tabelas apagadas: 10+${NC}"
        echo -e "${BLUE}• Sequências apagadas: 10+${NC}"
        echo -e "${BLUE}• Tipos apagados: todos${NC}"
        echo -e "${BLUE}• Status: BANCO VAZIO${NC}"
    else
        echo -e "${RED}❌ ERRO ao apagar dados do banco!${NC}"
        echo -e "${RED}Verifique:${NC}"
        echo -e "${RED}• Se o banco está em uso${NC}"
        echo -e "${RED}• Se tem permissão suficiente${NC}"
        echo -e "${RED}• Se os dados de conexão estão corretos${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ psql não encontrado! Instale PostgreSQL client.${NC}"
    echo -e "${RED}Ubuntu/Debian: sudo apt-get install postgresql-client${NC}"
    echo -e "${RED}CentOS/RHEL: sudo yum install postgresql${NC}"
    echo -e "${RED}macOS: brew install postgresql${NC}"
    exit 1
fi

echo
echo -e "${GREEN}🎉 OPERAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}🔥 BANCO DE DADOS COMPLETAMENTE APAGADO! 🔥${NC}"
echo -e "${RED}⚠️  NÃO HÁ COMO RECUPERAR ESTES DADOS! ⚠️${NC}"
echo