#!/bin/bash

# =============================================================================
# LIMPAR DADOS DO BANCO DOCKER - MANTER APENAS ESTRUTURA - CRED30
# =============================================================================

set -e

echo ""
echo "🗑️ LIMPAR DADOS DO BANCO DOCKER - CRED30"
echo "🚨 ATENÇÃO: Isso irá APAGAR TODOS OS DADOS mas manter a estrutura!"
echo ""

# Verificar se o container está rodando
if ! docker ps | grep -q "cred30-postgres\|cred30-db-local"; then
    echo "❌ Container PostgreSQL não está rodando!"
    echo "📋 Inicie o container com:"
    echo "   docker-compose -f docker/docker-compose.yml up -d"
    echo "   ou"
    echo "   docker-compose -f docker/docker-compose.local.yml up -d"
    exit 1
fi

# Determinar nome do container
CONTAINER_NAME="cred30-postgres"
if docker ps | grep -q "cred30-db-local"; then
    CONTAINER_NAME="cred30-db-local"
fi

echo "📦 Container encontrado: $CONTAINER_NAME"

# Criar diretório de backups se não existir
mkdir -p ./backups

# Gerar timestamp para backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="./backups/cred30_backup_before_wipe_${TIMESTAMP}.sql"

# Criar backup antes de limpar
echo "💾 Criando backup antes de apagar..."
docker exec "$CONTAINER_NAME" pg_dump -U cred30user -d cred30 > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Comprimir backup
    gzip "$BACKUP_FILE"
    echo "✅ Backup criado: ./backups/cred30_backup_before_wipe_${TIMESTAMP}.sql.gz"
else
    echo "❌ Falha ao criar backup! Abortando..."
    exit 1
fi

echo ""
echo "🔥 APAGANDO TODOS OS DADOS (MANTENDO ESTRUTURA)..."
echo ""

# Criar script SQL temporário para limpar dados
SQL_SCRIPT="/tmp/limpar_dados_${TIMESTAMP}.sql"

cat > "$SQL_SCRIPT" << 'EOF'
-- Script para limpar todos os dados mantendo a estrutura
-- Desabilitar triggers temporariamente
SET session_replication_role = replica;

-- Limpar tabelas em ordem correta (respeitando foreign keys)
-- Tabelas sem dependências primeiro
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;
TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE quotas RESTART IDENTITY CASCADE;
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;

-- Tabela de usuários (limpar por último devido às referências)
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Resetar configurações do sistema para valores padrão
UPDATE app_settings SET value = '50' WHERE key = 'quota_price';
UPDATE app_settings SET value = '0.2' WHERE key = 'loan_interest_rate';
UPDATE app_settings SET value = '0.4' WHERE key = 'penalty_rate';

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- Forçar atualização das estatísticas do PostgreSQL
ANALYZE;

-- Relatório final
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '  LIMPEZA DE DADOS CONCLUÍDA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Data/Hora: %', CURRENT_TIMESTAMP;
    RAISE NOTICE 'Estrutura mantida: SIM';
    RAISE NOTICE 'Dados removidos: TODOS';
    RAISE NOTICE 'Sequências resetadas: SIM';
    RAISE NOTICE '========================================';
END $$;
EOF

# Executar script de limpeza
docker exec -i "$CONTAINER_NAME" psql -U cred30user -d cred30 < "$SQL_SCRIPT"

# Remover script temporário
rm "$SQL_SCRIPT"

echo ""
echo "✅ DADOS APAGADOS COM SUCESSO!"
echo ""
echo "🎯 RESULTADO:"
echo "✅ Estrutura do banco mantida"
echo "❌ Todos os dados apagados"
echo "❌ Todos os usuários removidos"
echo "✅ Sistema pronto para novos dados"
echo ""
echo "🔄 PRÓXIMOS PASSOS:"
echo "1. Para inserir novos usuários via SQL:"
echo "   docker exec -it $CONTAINER_NAME psql -U cred30user -d cred30"
echo ""
echo "2. Para criar um novo admin:"
echo "   INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at)"
echo "   VALUES ('Seu Nome', 'seu@email.com', 'senha_hash', 'sua@chave.pix', 'sua_frase_secreta', 'CODIGO001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);"
echo ""
echo "3. Backup criado:"
echo "   ./backups/cred30_backup_before_wipe_${TIMESTAMP}.sql.gz"
echo ""

# Verificação final
echo "🔍 Verificando estado final do banco..."
USERS_COUNT=$(docker exec "$CONTAINER_NAME" psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
TABLES_COUNT=$(docker exec "$CONTAINER_NAME" psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

echo "Usuários restantes: $USERS_COUNT"
echo "Tabelas mantidas: $TABLES_COUNT"

if [ "$USERS_COUNT" -eq 0 ] && [ "$TABLES_COUNT" -gt 0 ]; then
    echo "✅ Confirmação: Dados apagados e estrutura mantida!"
else
    echo "⚠️  Alerta: Verificação final inconsistente"
fi

echo ""
echo "🎉 Operação concluída!"
echo ""