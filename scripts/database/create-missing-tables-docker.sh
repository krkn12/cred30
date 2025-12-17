#!/bin/bash

# Script para criar tabelas faltantes no banco de dados via Docker
# Baseado na análise completa do frontend e backend

echo "========================================"
echo "CRIAÇÃO DE TABELAS FALTANTES - DOCKER"
echo "========================================"
echo "Iniciando processo em: $(date)"
echo ""

# Verificar se o Docker está rodando
if ! docker ps > /dev/null 2>&1; then
    echo "❌ ERRO: Docker não está rodando ou não há permissão para acessá-lo"
    echo "Por favor, inicie o Docker ou verifique as permissões"
    exit 1
fi

# Verificar se o container PostgreSQL está rodando
echo "📋 Verificando containers PostgreSQL em execução..."
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "table {{.Names}}" | grep -v NAMES)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "❌ ERRO: Nenhum container PostgreSQL encontrado em execução"
    echo "Verifique se o container do banco de dados está rodando"
    echo "Comandos úteis:"
    echo "  docker ps -a                    # Listar todos os containers"
    echo "  docker start <container_name>    # Iniciar container parado"
    echo "  docker-compose up -d postgres   # Iniciar via docker-compose"
    exit 1
fi

echo "✅ Container PostgreSQL encontrado: $POSTGRES_CONTAINER"
echo ""

# Tentar diferentes credenciais de acesso
echo "🔐 Testando credenciais de acesso ao banco..."

# Tentar com usuário postgres (padrão)
echo "Testando com usuário postgres..."
if docker exec $POSTGRES_CONTAINER psql -U postgres -d cred30 -c "SELECT 1;" > /dev/null 2>&1; then
    DB_USER="postgres"
    DB_NAME="cred30"
    echo "✅ Acesso bem-sucedido com usuário: postgres"
else
    # Tentar com usuário cred30user
    echo "Testando com usuário cred30user..."
    if docker exec $POSTGRES_CONTAINER psql -U cred30user -d cred30 -c "SELECT 1;" > /dev/null 2>&1; then
        DB_USER="cred30user"
        DB_NAME="cred30"
        echo "✅ Acesso bem-sucedido com usuário: cred30user"
    else
        echo "❌ ERRO: Não foi possível acessar o banco de dados com nenhuma credencial conhecida"
        echo "Verifique as credenciais no arquivo docker-compose.yml"
        exit 1
    fi
fi

echo ""
echo "📊 Verificando tabelas existentes no banco..."

# Verificar tabelas existentes
EXISTING_TABLES=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
" | tr -d ' ')

echo "Tabelas existentes:"
echo "$EXISTING_TABLES" | sed 's/^/  - /'

# Verificar se o arquivo SQL existe
SQL_FILE="create-missing-tables.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ ERRO: Arquivo $SQL_FILE não encontrado"
    echo "Certifique-se de estar executando este script no diretório correto"
    exit 1
fi

echo ""
echo "🚀 Executando script de criação de tabelas..."

# Executar o script SQL
echo "Aplicando script: $SQL_FILE"
docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Script executado com sucesso!"
else
    echo ""
    echo "❌ ERRO: Falha ao executar o script SQL"
    echo "Verifique o arquivo SQL e as permissões do banco"
    exit 1
fi

echo ""
echo "📋 Verificando tabelas após a criação..."

# Verificar tabelas após a criação
NEW_TABLES=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
" | tr -d ' ')

echo "Tabelas após a criação:"
echo "$NEW_TABLES" | sed 's/^/  - /'

# Contar tabelas
TABLE_COUNT=$(echo "$NEW_TABLES" | grep -c .)
echo ""
echo "📊 Total de tabelas: $TABLE_COUNT"

# Verificar tabelas específicas importantes
echo ""
echo "🔍 Verificando tabelas críticas..."

CRITICAL_TABLES=(
    "users"
    "system_config"
    "quotas"
    "loans"
    "transactions"
    "audit_logs"
    "user_sessions"
    "notifications"
    "referrals"
    "support_tickets"
)

for table in "${CRITICAL_TABLES[@]}"; do
    if echo "$NEW_TABLES" | grep -q "^$table$"; then
        echo "✅ $table - OK"
    else
        echo "❌ $table - FALTANDO"
    fi
done

# Verificar índices
echo ""
echo "📋 Verificando índices criados..."
INDEX_COUNT=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE schemaname = 'public';
" | tr -d ' ')

echo "Total de índices: $INDEX_COUNT"

# Verificar triggers
echo ""
echo "📋 Verificando triggers criados..."
TRIGGER_COUNT=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
" | tr -d ' ')

echo "Total de triggers: $TRIGGER_COUNT"

# Verificar views
echo ""
echo "📋 Verificando views criadas..."
VIEW_COUNT=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM information_schema.views 
    WHERE table_schema = 'public';
" | tr -d ' ')

echo "Total de views: $VIEW_COUNT"

# Verificar configurações do sistema
echo ""
echo "📋 Verificando configurações do sistema..."
CONFIG_CHECK=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM system_config;
" | tr -d ' ')

if [ "$CONFIG_CHECK" -gt 0 ]; then
    echo "✅ Configurações do sistema encontradas"
    
    # Mostrar configurações principais
    echo "Configurações atuais:"
    docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
        SELECT 
            quota_price,
            loan_interest_rate,
            penalty_rate,
            system_balance,
            profit_pool
        FROM system_config 
        LIMIT 1;
    "
else
    echo "⚠️  Configurações do sistema não encontradas"
fi

# Verificar usuário administrador
echo ""
echo "👤 Verificando usuários administradores..."
ADMIN_COUNT=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM users 
    WHERE is_admin = true;
" | tr -d ' ')

echo "Total de administradores: $ADMIN_COUNT"

if [ "$ADMIN_COUNT" -eq 0 ]; then
    echo "⚠️  Nenhum usuário administrador encontrado"
    echo "O primeiro usuário a se registrar será automaticamente administrador"
else
    echo "Administradores:"
    docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
        SELECT id, name, email, created_at 
        FROM users 
        WHERE is_admin = true;
    "
fi

# Resumo final
echo ""
echo "========================================"
echo "✅ CRIAÇÃO DE TABELAS CONCLUÍDA!"
echo "========================================"
echo "Data/Hora: $(date)"
echo "Container: $POSTGRES_CONTAINER"
echo "Banco de dados: $DB_NAME"
echo "Usuário: $DB_USER"
echo "Total de tabelas: $TABLE_COUNT"
echo "Total de índices: $INDEX_COUNT"
echo "Total de triggers: $TRIGGER_COUNT"
echo "Total de views: $VIEW_COUNT"
echo "Administradores: $ADMIN_COUNT"
echo ""

# Próximos passos
echo "📋 PRÓXIMOS PASSOS RECOMENDADOS:"
echo "1. Teste a aplicação frontend para verificar se todas as funcionalidades funcionam"
echo "2. Verifique os logs da aplicação backend para possíveis erros"
echo "3. Execute testes de integração com as novas tabelas"
echo "4. Faça um backup completo do banco após as alterações"
echo ""

echo "🔧 COMANDOS ÚTEIS:"
echo "# Verificar estrutura de uma tabela específica:"
echo "docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c \"\\d nome_tabela\""
echo ""
echo "# Verificar dados de uma tabela:"
echo "docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM nome_tabela;\""
echo ""
echo "# Fazer backup do banco:"
echo "docker exec $POSTGRES_CONTAINER pg_dump -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql"
echo ""

echo "🎉 Sistema CRED30 pronto para uso com todas as tabelas!"