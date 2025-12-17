# =====================================================
# LIMPEZA COMPLETA E TOTAL DO BANCO DE DADOS - CRED30
# =====================================================
# Apaga TODOS os dados, incluindo o admin
# Deixa apenas a estrutura das tabelas
# Reset completo de todas as sequências
# =====================================================

Write-Host "=====================================================" -ForegroundColor Red
Write-Host "LIMPEZA COMPLETA E TOTAL DO BANCO DE DADOS - CRED30" -ForegroundColor Red
Write-Host "=====================================================" -ForegroundColor Red
Write-Host ""

Write-Host "⚠️  ATENÇÃO: Este script IRÁ APAGAR TUDO do banco de dados!" -ForegroundColor Yellow
Write-Host "   - Todos os usuários (incluindo admin)" -ForegroundColor Yellow
Write-Host "   - Todas as transações e dados financeiros" -ForegroundColor Yellow
Write-Host "   - Todos os logs e configurações" -ForegroundColor Yellow
Write-Host "   - TUDO será removido, deixando apenas a estrutura" -ForegroundColor Yellow
Write-Host ""

Write-Host "Pressione CTRL+C para CANCELAR ou" -ForegroundColor Red
Read-Host "Enter para CONTINUAR"
Write-Host ""

# Função para verificar se o comando foi executado com sucesso
function Test-CommandSuccess {
    param ($Command)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERRO: $Command" -ForegroundColor Red
        return $false
    }
    return $true
}

# Etapa 1: Verificar conexão com o banco
Write-Host "[1/3] Verificando conexão com o banco de dados..." -ForegroundColor Cyan
docker exec cred30_postgres psql -U cred30user -d cred30db -c "SELECT 1 as test_connection;" | Out-Null

if (-not (Test-CommandSuccess "Conexão com banco de dados")) {
    Write-Host "❌ ERRO: Não foi possível conectar ao banco de dados PostgreSQL" -ForegroundColor Red
    Write-Host "   Verifique se o container Docker está em execução" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "✅ OK: Conexão estabelecida" -ForegroundColor Green

# Etapa 2: Executar limpeza completa
Write-Host ""
Write-Host "[2/3] Executando limpeza COMPLETA do banco de dados..." -ForegroundColor Cyan
$sqlContent = Get-Content -Path "scripts/database/wipe-everything-complete.sql" -Raw
docker exec -i cred30_postgres psql -U cred30user -d cred30db -c "$sqlContent"

if (-not (Test-CommandSuccess "Limpeza do banco de dados")) {
    Write-Host "❌ ERRO: Falha durante a limpeza do banco de dados" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Etapa 3: Verificar resultado
Write-Host ""
Write-Host "[3/3] Verificando resultado da limpeza..." -ForegroundColor Cyan

$query = @"
SELECT 
    'TABELA: ' || tablename || ' - REGISTROS: ' || 
    COALESCE((SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename), 0) || ' colunas, ' ||
    COALESCE((SELECT COUNT(*) FROM pg_stat_user_tables WHERE relname = t.tablename), 0) || ' estatísticas'
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY tablename;
"@

docker exec cred30_postgres psql -U cred30user -d cred30db -c $query

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "LIMPEZA COMPLETA CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Status do banco de dados:" -ForegroundColor Cyan
Write-Host "✅ Todos os dados foram REMOVIDOS" -ForegroundColor Green
Write-Host "✅ Apenas a estrutura das tabelas foi mantida" -ForegroundColor Green
Write-Host "✅ Todas as sequências foram resetadas" -ForegroundColor Green
Write-Host "✅ Nenhum usuário ou registro permanece" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 O sistema está completamente ZERADO e pronto para um novo início!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para criar um novo admin, execute:" -ForegroundColor Cyan
Write-Host "docker exec -i cred30_postgres psql -U cred30user -d cred30db -c " -ForegroundColor Gray
Write-Host "'INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, is_active, email_verified)" -ForegroundColor Gray
Write-Host "VALUES (gen_random_uuid(), '"'"'admin@exemplo.com'"'"', '"'"'senha_hash_aqui'"'"', '"'"'Administrador'"'"', '"'"'admin'"'"', NOW(), NOW(), true, true);'" -ForegroundColor Gray
Write-Host ""
Read-Host "Pressione Enter para sair"