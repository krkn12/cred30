#!/bin/bash

# =============================================================================
# LIMPEZA SEGURA DO BANCO DE DADOS DOCKER - CRED30
# =============================================================================
# Este script oferece 3 níveis de limpeza com diferentes graus de segurança
# Autor: Assistente IA
# Data: $(date +%Y-%m-%d)
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações
CONTAINER_NAME="cred30-postgres"
DB_USER="cred30user"
DB_NAME="cred30"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Função para verificar se o container está rodando
check_container() {
    if ! docker ps | grep -q $CONTAINER_NAME; then
        echo -e "${RED}❌ Container $CONTAINER_NAME não está rodando!${NC}"
        echo -e "${YELLOW}📋 Containers disponíveis:${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        exit 1
    fi
}

# Função para criar backup antes da limpeza
create_backup() {
    echo -e "${BLUE}💾 Criando backup antes da limpeza...${NC}"
    
    # Criar diretório de backup se não existir
    mkdir -p $BACKUP_DIR
    
    # Criar backup completo
    if docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > "$BACKUP_DIR/cred30_backup_before_cleanup_$TIMESTAMP.sql"; then
        echo -e "${GREEN}✅ Backup criado: $BACKUP_DIR/cred30_backup_before_cleanup_$TIMESTAMP.sql${NC}"
        
        # Compactar backup
        gzip "$BACKUP_DIR/cred30_backup_before_cleanup_$TIMESTAMP.sql"
        echo -e "${GREEN}✅ Backup compactado${NC}"
    else
        echo -e "${RED}❌ Falha ao criar backup!${NC}"
        return 1
    fi
}

# Função para verificar integridade após limpeza
verify_cleanup() {
    echo -e "${CYAN}🔍 Verificando integridade do banco após limpeza...${NC}"
    
    # Verificar se as tabelas principais existem
    local tables_check=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN '✅'
                ELSE '❌'
            END as users,
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotas') THEN '✅'
                ELSE '❌'
            END as quotas,
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans') THEN '✅'
                ELSE '❌'
            END as loans,
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN '✅'
                ELSE '❌'
            END as transactions;
    ")
    
    echo -e "${BLUE}📊 Status das tabelas principais:${NC}"
    echo "$tables_check"
    
    # Verificar contagens
    local counts=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "
        SELECT 
            'users' as table_name, COUNT(*) as count FROM users
        UNION ALL
        SELECT 
            'quotas' as table_name, COUNT(*) as count FROM quotas
        UNION ALL
        SELECT 
            'loans' as table_name, COUNT(*) as count FROM loans
        UNION ALL
        SELECT 
            'transactions' as table_name, COUNT(*) as count FROM transactions;
    ")
    
    echo -e "${BLUE}📈 Contagem de registros:${NC}"
    echo "$counts"
}

# Opção 1: Limpeza Segura (apenas dados, mantém estrutura)
safe_cleanup() {
    echo -e "${GREEN}🛡️ INICIANDO LIMPEZA SEGURA (apenas dados)${NC}"
    echo -e "${YELLOW}⚠️  Apenas os dados serão removidos, estrutura mantida${NC}"
    echo
    
    create_backup
    
    echo -e "${YELLOW}🧹 Limpando dados das tabelas...${NC}"
    
    # Script SQL para limpeza segura
    local safe_sql="
    -- Iniciar transação
    BEGIN;
    
    -- Desabilitar triggers temporariamente
    ALTER TABLE users DISABLE TRIGGER ALL;
    ALTER TABLE quotas DISABLE TRIGGER ALL;
    ALTER TABLE loans DISABLE TRIGGER ALL;
    ALTER TABLE transactions DISABLE TRIGGER ALL;
    
    -- Limpar tabelas em ordem de dependência (sem DROP)
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
    
    -- Manter apenas o admin principal
    DELETE FROM users WHERE email != 'josiassm701@gmail.com';
    
    -- Resetar configurações do sistema (manter estrutura)
    UPDATE system_config SET 
        system_balance = 0,
        profit_pool = 0,
        quota_price = 50.00,
        loan_interest_rate = 0.20,
        penalty_rate = 0.40,
        vesting_period_ms = 365 * 24 * 60 * 60 * 1000;
    
    -- Resetar sequências
    ALTER SEQUENCE users_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotas_id_seq RESTART WITH 1;
    ALTER SEQUENCE loans_id_seq RESTART WITH 1;
    ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
    
    -- Reabilitar triggers
    ALTER TABLE users ENABLE TRIGGER ALL;
    ALTER TABLE quotas ENABLE TRIGGER ALL;
    ALTER TABLE loans ENABLE TRIGGER ALL;
    ALTER TABLE transactions ENABLE TRIGGER ALL;
    
    -- Confirmar transação
    COMMIT;
    
    -- Forçar atualização de estatísticas
    ANALYZE;
    "
    
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$safe_sql"; then
        echo -e "${GREEN}✅ Limpeza segura concluída!${NC}"
        verify_cleanup
        return 0
    else
        echo -e "${RED}❌ Falha na limpeza segura!${NC}"
        return 1
    fi
}

# Opção 2: Limpeza Completa (recria estrutura)
complete_cleanup() {
    echo -e "${RED}🔥 INICIANDO LIMPEZA COMPLETA${NC}"
    echo -e "${RED}⚠️  ATENÇÃO: Todas as tabelas serão dropadas e recriadas!${NC}"
    echo
    
    create_backup
    
    echo -e "${YELLOW}🔄 Recriando estrutura completa do banco...${NC}"
    
    # Usar o script SQL de inicialização
    if docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < ./init-db-fixed.sql; then
        echo -e "${GREEN}✅ Estrutura recriada com sucesso!${NC}"
        
        # Inserir admin básico
        docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at) VALUES
        ('Administrador', 'josiassm701@gmail.com', 'admin_hash_temp', 'admin@pix.local', 'admin_secret', 'ADMIN001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO NOTHING;
        "
        
        verify_cleanup
        return 0
    else
        echo -e "${RED}❌ Falha na recriação da estrutura!${NC}"
        return 1
    fi
}

# Opção 3: Reset Total (apaga tudo e recria do zero)
total_reset() {
    echo -e "${PURPLE}💣 INICIANDO RESET TOTAL${NC}"
    echo -e "${RED}🚨 ATENÇÃO MÁXIMA: Banco será completamente apagado!${NC}"
    echo
    
    create_backup
    
    echo -e "${RED}🗑️ Apagando TODAS as tabelas...${NC}"
    
    # Script SQL para reset total
    local reset_sql="
    -- Dropar todas as tabelas
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    
    -- Recriar extensões necessárias
    CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
    CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
    
    -- Confirmar
    SELECT 'Schema público recriado' as status;
    "
    
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$reset_sql"; then
        echo -e "${GREEN}✅ Schema público recriado!${NC}"
        
        # Recriar estrutura completa
        if docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < ./init-db-fixed.sql; then
            echo -e "${GREEN}✅ Reset total concluído!${NC}"
            
            # NÃO inserir admin básico (apaga tudo inclusive admin)
            echo -e "${YELLOW}⚠️  Nenhum usuário inserido (inclusive admin)${NC}"
            
            verify_cleanup
            return 0
        else
            echo -e "${RED}❌ Falha na recriação da estrutura!${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Falha no reset do schema!${NC}"
        return 1
    fi
}

# Opção 4: Apagar TUDO (inclusive admin)
wipe_everything() {
    echo -e "${RED}💀 INICIANDO APAGAR COMPLETO (TUDO INCLUSIVE ADMIN)${NC}"
    echo -e "${RED}🚨 ATENÇÃO EXTREMA: Todos os dados serão apagados!${NC}"
    echo
    
    create_backup
    
    echo -e "${RED}🔥 Apagando TODOS os dados (inclusive admin)...${NC}"
    
    # Script SQL para apagar tudo mantendo estrutura
    local wipe_sql="
    -- Iniciar transação
    BEGIN;
    
    -- Desabilitar triggers temporariamente
    ALTER TABLE users DISABLE TRIGGER ALL;
    ALTER TABLE quotas DISABLE TRIGGER ALL;
    ALTER TABLE loans DISABLE TRIGGER ALL;
    ALTER TABLE transactions DISABLE TRIGGER ALL;
    
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
    
    -- Apagar TODOS os usuários (inclusive admin)
    DELETE FROM users;
    
    -- Resetar configurações do sistema
    UPDATE system_config SET
        system_balance = 0,
        profit_pool = 0,
        quota_price = 50.00,
        loan_interest_rate = 0.20,
        penalty_rate = 0.40,
        vesting_period_ms = 365 * 24 * 60 * 60 * 1000;
    
    -- Resetar sequências
    ALTER SEQUENCE users_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotas_id_seq RESTART WITH 1;
    ALTER SEQUENCE loans_id_seq RESTART WITH 1;
    ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
    
    -- Reabilitar triggers
    ALTER TABLE users ENABLE TRIGGER ALL;
    ALTER TABLE quotas ENABLE TRIGGER ALL;
    ALTER TABLE loans ENABLE TRIGGER ALL;
    ALTER TABLE transactions ENABLE TRIGGER ALL;
    
    -- Confirmar transação
    COMMIT;
    
    -- Forçar atualização de estatísticas
    ANALYZE;
    
    -- Relatório final
    DO \$\$
    BEGIN
        RAISE NOTICE '========================================';
        RAISE NOTICE '  APAGAR COMPLETO DO BANCO DE DADOS';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Data/Hora: %', CURRENT_TIMESTAMP;
        RAISE NOTICE 'Total de tabelas limpas: 25';
        RAISE NOTICE 'Usuários apagados: TODOS (inclusive admin)';
        RAISE NOTICE 'Dados removidos: TUDO';
        RAISE NOTICE 'Estrutura mantida: SIM';
        RAISE NOTICE 'Sequências resetadas: SIM';
        RAISE NOTICE '========================================';
    END \$\$;
    "
    
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$wipe_sql"; then
        echo -e "${GREEN}✅ Apagamento completo concluído!${NC}"
        echo -e "${RED}🎯 RESULTADO:${NC}"
        echo -e "${RED}✅ BANCO 100% VAZIO${NC}"
        echo -e "${RED}✅ TODOS OS DADOS APAGADOS${NC}"
        echo -e "${RED}✅ INCLUSIVE O ADMINISTRADOR${NC}"
        echo -e "${RED}✅ SISTEMA PRECISA SER REINICIALIZADO${NC}"
        echo
        echo -e "${BLUE}🔄 PRÓXIMOS PASSOS:${NC}"
        echo -e "${YELLOW}1. Para recriar o banco:${NC}"
        echo -e "${GREEN}   docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql${NC}"
        echo -e "${YELLOW}2. Acesse a aplicação e crie o primeiro admin${NC}"
        echo
        verify_cleanup
        return 0
    else
        echo -e "${RED}❌ Falha no apagamento completo!${NC}"
        return 1
    fi
}

# Menu principal
show_menu() {
    clear
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}    🔧 GERENCIADOR DE LIMPEZA DO BANCO CRED30${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo
    echo -e "${GREEN}📋 Escolha o nível de limpeza:${NC}"
    echo
    echo -e "${GREEN}1)${NC} ${YELLOW}Limpeza Segura${NC} - Apenas dados, mantém estrutura"
    echo -e "   ${BLUE}→ Remove todos os dados mas preserva tabelas e estrutura${NC}"
    echo -e "   ${BLUE}→ Mantém usuário admin e configurações básicas${NC}"
    echo
    echo -e "${GREEN}2)${NC} ${YELLOW}Limpeza Completa${NC} - Recria estrutura do zero"
    echo -e "   ${BLUE}→ Dropa e recria todas as tabelas${NC}"
    echo -e "   ${BLUE}→ Mantém dados básicos de configuração${NC}"
    echo
    echo -e "${GREEN}3)${NC} ${RED}Reset Total${NC} - Apaga tudo e recria do zero"
    echo -e "   ${RED}→ Opção mais drástica e irreversível${NC}"
    echo -e "   ${RED}→ Recomendada apenas para desenvolvimento${NC}"
    echo
    echo -e "${GREEN}4)${NC} ${RED}💀 Apagar TUDO (inclusive Admin)${NC}"
    echo -e "   ${RED}→ Remove TODOS os dados incluindo o administrador${NC}"
    echo -e "   ${RED}→ Banco fica 100% vazio, precisa recriar admin${NC}"
    echo
    echo -e "${GREEN}5)${NC} ${BLUE}Verificar Status Atual${NC}"
    echo -e "   ${BLUE}→ Mostra contagem atual das tabelas${NC}"
    echo
    echo -e "${GREEN}6)${NC} ${PURPLE}Criar Backup Apenas${NC}"
    echo -e "   ${BLUE}→ Cria backup sem modificar dados${NC}"
    echo
    echo -e "${GREEN}0)${NC} ${RED}Sair${NC}"
    echo
    echo -e "${CYAN}============================================================================${NC}"
}

# Verificar status atual
check_status() {
    echo -e "${BLUE}📊 VERIFICANDO STATUS ATUAL DO BANCO${NC}"
    echo
    
    if check_container; then
        verify_cleanup
    fi
}

# Programa principal
main() {
    # Verificar se o container está rodando
    if ! check_container; then
        exit 1
    fi
    
    while true; do
        show_menu
        echo -n -e "${GREEN}Digite sua opção [0-6]: ${NC}"
        read choice
        
        case $choice in
            1)
                safe_cleanup
                ;;
            2)
                complete_cleanup
                ;;
            3)
                total_reset
                ;;
            4)
                wipe_everything
                ;;
            5)
                check_status
                ;;
            6)
                create_backup
                echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
                ;;
            0)
                echo -e "${GREEN}👋 Saindo...${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Opção inválida! Tente novamente.${NC}"
                sleep 2
                ;;
        esac
        
        echo
        echo -e "${YELLOW}Pressione Enter para continuar...${NC}"
        read
    done
}

# Executar main se o script for chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi