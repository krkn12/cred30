# =============================================================================
# LIMPAR DADOS DO BANCO DOCKER - MANTER APENAS ESTRUTURA - CRED30 (POWERSHELL)
# =============================================================================

Write-Host ""
Write-Host "🗑️ LIMPAR DADOS DO BANCO DOCKER - CRED30" -ForegroundColor Yellow
Write-Host "🚨 ATENÇÃO: Isso irá APAGAR TODOS OS DADOS mas manter a estrutura!" -ForegroundColor Red
Write-Host ""

# Verificar se o container está rodando
$containerRunning = docker ps | Select-String "cred30-postgres"
if (-not $containerRunning) {
    $containerRunning = docker ps | Select-String "cred30-db-local"
    if (-not $containerRunning) {
        Write-Host "❌ Container PostgreSQL não está rodando!" -ForegroundColor Red
        Write-Host "📋 Inicie o container com:" -ForegroundColor Cyan
        Write-Host "   docker-compose -f docker/docker-compose.yml up -d" -ForegroundColor White
        Write-Host "   ou" -ForegroundColor White
        Write-Host "   docker-compose -f docker/docker-compose.local.yml up -d" -ForegroundColor White
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}

# Determinar nome do container
$containerName = "cred30-postgres"
$containerCheck = docker ps | Select-String "cred30-db-local"
if ($containerCheck) {
    $containerName = "cred30-db-local"
}

Write-Host "📦 Container encontrado: $containerName" -ForegroundColor Green

# Criar diretório de backups se não existir
if (-not (Test-Path "./backups")) {
    New-Item -ItemType Directory -Path "./backups" | Out-Null
}

# Gerar timestamp para backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "./backups/cred30_backup_before_wipe_$timestamp.sql"

# Criar backup antes de limpar
Write-Host "💾 Criando backup antes de apagar..." -ForegroundColor Blue
$backupResult = docker exec $containerName pg_dump -U cred30user -d cred30 | Out-File -FilePath $backupFile -Encoding UTF8

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha ao criar backup! Abortando..." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Comprimir backup
try {
    Compress-Archive -Path $backupFile -DestinationPath "$backupFile.gz" -Force
    Remove-Item $backupFile -Force
    $backupFile = "$backupFile.gz"
    Write-Host "✅ Backup criado: $backupFile" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backup criado sem compressão: $backupFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔥 APAGANDO TODOS OS DADOS (MANTENDO ESTRUTURA)..." -ForegroundColor Red
Write-Host ""

# Criar script SQL temporário para limpar dados
$tempSqlFile = "limpar_dados_temp.sql"

# Usar Here-String com escape para evitar problemas de parsing
$sqlContent = @'
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
'@

# Salvar script SQL temporário
$sqlContent | Out-File -FilePath $tempSqlFile -Encoding UTF8

# Executar script de limpeza
docker exec -i $containerName psql -U cred30user -d cred30 < $tempSqlFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha ao apagar dados!" -ForegroundColor Red
    if (Test-Path $tempSqlFile) {
        Remove-Item $tempSqlFile -Force
    }
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Limpar arquivo temporário
if (Test-Path $tempSqlFile) {
    Remove-Item $tempSqlFile -Force
}

Write-Host ""
Write-Host "✅ DADOS APAGADOS COM SUCESSO!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 RESULTADO:" -ForegroundColor Cyan
Write-Host "✅ Estrutura do banco mantida" -ForegroundColor Green
Write-Host "❌ Todos os dados apagados" -ForegroundColor Red
Write-Host "❌ Todos os usuários removidos" -ForegroundColor Red
Write-Host "✅ Sistema pronto para novos dados" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. Para inserir novos usuários via SQL:" -ForegroundColor White
Write-Host "   docker exec -it $containerName psql -U cred30user -d cred30" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Para criar um novo admin:" -ForegroundColor White
Write-Host "   INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at)" -ForegroundColor Gray
Write-Host "   VALUES ('Seu Nome', 'seu@email.com', 'senha_hash', 'sua@chave.pix', 'sua_frase_secreta', 'CODIGO001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Backup criado:" -ForegroundColor White
Write-Host "   $backupFile" -ForegroundColor Gray
Write-Host ""

# Verificação final
Write-Host "🔍 Verificando estado final do banco..." -ForegroundColor Blue
$usersCount = docker exec $containerName psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users;" | ForEach-Object { $_.Trim() }
$tablesCount = docker exec $containerName psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | ForEach-Object { $_.Trim() }

Write-Host "Usuários restantes: $usersCount" -ForegroundColor White
Write-Host "Tabelas mantidas: $tablesCount" -ForegroundColor White

if ($usersCount -eq 0 -and $tablesCount -gt 0) {
    Write-Host "✅ Confirmação: Dados apagados e estrutura mantida!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Alerta: Verificação final inconsistente" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Operação concluída!" -ForegroundColor Green
Write-Host ""
Read-Host "Pressione Enter para sair"