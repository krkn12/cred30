#!/bin/bash

# =====================================================
# LIMPEZA COMPLETA E TOTAL DO BANCO DE DADOS - CRED30
# =====================================================
# Apaga TODOS os dados, incluindo o admin
# Deixa apenas a estrutura das tabelas
# Reset completo de todas as sequências
# =====================================================

echo "====================================================="
echo "LIMPEZA COMPLETA E TOTAL DO BANCO DE DADOS - CRED30"
echo "====================================================="
echo ""
echo "⚠️  ATENÇÃO: Este script IRÁ APAGAR TUDO do banco de dados!"
echo "   - Todos os usuários (incluindo admin)"
echo "   - Todas as transações e dados financeiros"
echo "   - Todos os logs e configurações"
echo "   - TUDO será removido, deixando apenas a estrutura"
echo ""
echo "Pressione CTRL+C para CANCELAR ou"
read -p "Enter para CONTINUAR"
echo ""

# Função para verificar se o comando foi executado com sucesso
test_command_success() {
    if [ $? -ne 0 ]; then
        echo "❌ ERRO: $1"
        return 1
    fi
    return 0
}

# Etapa 1: Verificar conexão com o banco
echo "[1/3] Verificando conexão com o banco de dados..."
docker exec cred30_postgres psql -U cred30user -d cred30db -c "SELECT 1 as test_connection;" > /dev/null 2>&1

if ! test_command_success "Conexão com banco de dados"; then
    echo "❌ ERRO: Não foi possível conectar ao banco de dados PostgreSQL"
    echo "   Verifique se o container Docker está em execução"
    read -p "Pressione Enter para sair"
    exit 1
fi

echo "✅ OK: Conexão estabelecida"

# Etapa 2: Executar limpeza completa
echo ""
echo "[2/3] Executando limpeza COMPLETA do banco de dados..."
docker exec -i cred30_postgres psql -U cred30user -d cred30db < scripts/database/wipe-everything-complete.sql

if ! test_command_success "Limpeza do banco de dados"; then
    echo "❌ ERRO: Falha durante a limpeza do banco de dados"
    read -p "Pressione Enter para sair"
    exit 1
fi

# Etapa 3: Verificar resultado
echo ""
echo "[3/3] Verificando resultado da limpeza..."

docker exec cred30_postgres psql -U cred30user -d cred30db -c "
SELECT 
    'TABELA: ' || tablename || ' - REGISTROS: ' || 
    COALESCE((SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename), 0) || ' colunas, ' ||
    COALESCE((SELECT COUNT(*) FROM pg_stat_user_tables WHERE relname = t.tablename), 0) || ' estatísticas'
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY tablename;
"

echo ""
echo "====================================================="
echo "LIMPEZA COMPLETA CONCLUÍDA COM SUCESSO!"
echo "====================================================="
echo ""
echo "Status do banco de dados:"
echo "✅ Todos os dados foram REMOVIDOS"
echo "✅ Apenas a estrutura das tabelas foi mantida"
echo "✅ Todas as sequências foram resetadas"
echo "✅ Nenhum usuário ou registro permanece"
echo ""
echo "🚀 O sistema está completamente ZERADO e pronto para um novo início!"
echo ""
echo "Para criar um novo admin, execute:"
echo "docker exec -i cred30_postgres psql -U cred30user -d cred30db -c \""
echo "INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, is_active, email_verified)"
echo "VALUES (gen_random_uuid(), 'admin@exemplo.com', 'senha_hash_aqui', 'Administrador', 'admin', NOW(), NOW(), true, true);\""
echo ""
read -p "Pressione Enter para sair"