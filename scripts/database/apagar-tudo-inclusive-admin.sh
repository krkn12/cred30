#!/bin/bash

# =============================================================================
# APAGAR TUDO (INCLUSIVE ADMIN) - CRED30
# =============================================================================
# Script simples e direto para apagar 100% dos dados do banco
# Autor: Assistente IA
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
CONTAINER_NAME="cred30-postgres"
DB_USER="cred30user"
DB_NAME="cred30"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${RED}💀 APAGAR TUDO (INCLUSIVE ADMIN) - CRED30${NC}"
echo -e "${RED}🚨 ATENÇÃO: ESTE SCRIPT APAGARÁ 100% DOS DADOS!${NC}"
echo

# Verificar se o container está rodando
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo -e "${RED}❌ Container $CONTAINER_NAME não está rodando!${NC}"
    exit 1
fi

# Criar backup
echo -e "${BLUE}💾 Criando backup de emergência...${NC}"
mkdir -p ./backups
if docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > "./backups/emergency_backup_before_wipe_$TIMESTAMP.sql"; then
    gzip "./backups/emergency_backup_before_wipe_$TIMESTAMP.sql"
    echo -e "${GREEN}✅ Backup criado: ./backups/emergency_backup_before_wipe_$TIMESTAMP.sql.gz${NC}"
else
    echo -e "${RED}❌ Falha ao criar backup! Abortando...${NC}"
    exit 1
fi

echo
echo -e "${RED}🔥 INICIANDO APAGAMENTO COMPLETO...${NC}"
echo

# Script SQL para apagar tudo
WIPE_SQL="
-- Iniciar transação
BEGIN;

-- Desabilitar todos os triggers
ALTER TABLE users DISABLE TRIGGER ALL;
ALTER TABLE quotas DISABLE TRIGGER ALL;
ALTER TABLE loans DISABLE TRIGGER ALL;
ALTER TABLE transactions DISABLE TRIGGER ALL;
ALTER TABLE loan_installments DISABLE TRIGGER ALL;
ALTER TABLE withdrawals DISABLE TRIGGER ALL;
ALTER TABLE user_statistics DISABLE TRIGGER ALL;
ALTER TABLE referrals DISABLE TRIGGER ALL;
ALTER TABLE support_tickets DISABLE TRIGGER ALL;
ALTER TABLE fee_history DISABLE TRIGGER ALL;
ALTER TABLE notifications DISABLE TRIGGER ALL;
ALTER TABLE user_sessions DISABLE TRIGGER ALL;
ALTER TABLE audit_logs DISABLE TRIGGER ALL;
ALTER TABLE admin_logs DISABLE TRIGGER ALL;
ALTER TABLE backup_logs DISABLE TRIGGER ALL;
ALTER TABLE rate_limit_logs DISABLE TRIGGER ALL;

-- Apagar TODOS os dados em ordem de dependência
DELETE FROM loan_installments;
DELETE FROM withdrawals;
DELETE FROM transactions;
DELETE FROM quotas;
DELETE FROM loans;
DELETE FROM user_statistics;
DELETE FROM referrals;
DELETE FROM support_tickets;
DELETE FROM fee_history;
DELETE FROM notifications;
DELETE FROM user_sessions;
DELETE FROM audit_logs;
DELETE FROM admin_logs;
DELETE FROM backup_logs;
DELETE FROM rate_limit_logs;

-- APAGAR TODOS OS USUÁRIOS (INCLUSIVE ADMIN)
DELETE FROM users;

-- Resetar configurações do sistema
UPDATE system_config SET 
    system_balance = 0,
    profit_pool = 0,
    quota_price = 50.00,
    loan_interest_rate = 0.20,
    penalty_rate = 0.40,
    vesting_period_ms = 365 * 24 * 60 * 60 * 1000;

-- Resetar todas as sequências
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE quotas_id_seq RESTART WITH 1;
ALTER SEQUENCE loans_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE loan_installments_id_seq RESTART WITH 1;
ALTER SEQUENCE withdrawals_id_seq RESTART WITH 1;
ALTER SEQUENCE user_statistics_id_seq RESTART WITH 1;
ALTER SEQUENCE referrals_id_seq RESTART WITH 1;
ALTER SEQUENCE support_tickets_id_seq RESTART WITH 1;
ALTER SEQUENCE fee_history_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE user_sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE audit_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE admin_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE backup_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE rate_limit_logs_id_seq RESTART WITH 1;

-- Reabilitar todos os triggers
ALTER TABLE users ENABLE TRIGGER ALL;
ALTER TABLE quotas ENABLE TRIGGER ALL;
ALTER TABLE loans ENABLE TRIGGER ALL;
ALTER TABLE transactions ENABLE TRIGGER ALL;
ALTER TABLE loan_installments ENABLE TRIGGER ALL;
ALTER TABLE withdrawals ENABLE TRIGGER ALL;
ALTER TABLE user_statistics ENABLE TRIGGER ALL;
ALTER TABLE referrals ENABLE TRIGGER ALL;
ALTER TABLE support_tickets ENABLE TRIGGER ALL;
ALTER TABLE fee_history ENABLE TRIGGER ALL;
ALTER TABLE notifications ENABLE TRIGGER ALL;
ALTER TABLE user_sessions ENABLE TRIGGER ALL;
ALTER TABLE audit_logs ENABLE TRIGGER ALL;
ALTER TABLE admin_logs ENABLE TRIGGER ALL;
ALTER TABLE backup_logs ENABLE TRIGGER ALL;
ALTER TABLE rate_limit_logs ENABLE TRIGGER ALL;

-- Confirmar transação
COMMIT;

-- Forçar atualização de estatísticas
ANALYZE;

-- Relatório final
DO \$\$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE '  APAGAMENTO COMPLETO REALIZADO COM SUCESSO';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Data/Hora: %', CURRENT_TIMESTAMP;
    RAISE NOTICE 'Usuarios apagados: TODOS (inclusive admin)';
    RAISE NOTICE 'Dados removidos: 100%';
    RAISE NOTICE 'Estrutura mantida: SIM';
    RAISE NOTICE 'Sequências resetadas: SIM';
    RAISE NOTICE '================================================';
END \$\$;
"

# Executar o script
if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$WIPE_SQL"; then
    echo
    echo -e "${GREEN}✅ APAGAMENTO COMPLETO CONCLUÍDO!${NC}"
    echo
    echo -e "${RED}🎯 RESULTADO FINAL:${NC}"
    echo -e "${RED}❌ BANCO 100% VAZIO${NC}"
    echo -e "${RED}❌ TODOS OS DADOS APAGADOS${NC}"
    echo -e "${RED}❌ INCLUSIVE O ADMINISTRADOR${NC}"
    echo -e "${RED}❌ SISTEMA PRECISA SER REINICIALIZADO${NC}"
    echo
    echo -e "${BLUE}🔄 PRÓXIMOS PASSOS:${NC}"
    echo -e "${YELLOW}1. Para recriar o banco completo:${NC}"
    echo -e "${GREEN}   docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql${NC}"
    echo
    echo -e "${YELLOW}2. Para criar um novo admin manualmente:${NC}"
    echo -e "${GREEN}   docker exec -it cred30-postgres psql -U cred30user -d cred30${NC}"
    echo -e "${GREEN}   INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at) VALUES${NC}"
    echo -e "${GREEN}   ('Seu Nome', 'seu@email.com', 'senha_hash', 'sua@chave.pix', 'sua_frase_secreta', 'CODIGO001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);${NC}"
    echo
    echo -e "${YELLOW}3. Backup de emergência criado:${NC}"
    echo -e "${GREEN}   ./backups/emergency_backup_before_wipe_$TIMESTAMP.sql.gz${NC}"
    echo
else
    echo -e "${RED}❌ FALHA NO APAGAMENTO!${NC}"
    echo -e "${YELLOW}Verifique o backup e tente manualmente${NC}"
    exit 1
fi

# Verificação final
echo -e "${BLUE}🔍 Verificando estado final do banco...${NC}"
USERS_COUNT=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
echo -e "${BLUE}Usuários restantes: $USERS_COUNT${NC}"

if [ "$USERS_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ Confirmação: Banco está completamente vazio${NC}"
else
    echo -e "${RED}❌ Alerta: Ainda existem $USERS_COUNT usuário(s) no banco${NC}"
fi

echo
echo -e "${GREEN}🎉 Operação concluída!${NC}"