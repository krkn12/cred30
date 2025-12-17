# =============================================================================
# APAGAR TUDO (INCLUSIVE ADMIN) - CRED30 (POWERSHELL)
# =============================================================================

$ErrorActionPreference = "Stop"

$CONTAINER_NAME = "cred30-postgres"
$DB_USER = "cred30user"
$DB_NAME = "cred30"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"

function Write-ColorText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-Host "💀 APAGAR TUDO (INCLUSIVE ADMIN) - CRED30" -ForegroundColor Red
Write-Host "🚨 ATENCAO: ESTE SCRIPT APAGARA 100% DOS DADOS!" -ForegroundColor Red
Write-Host ""

# Verificar container
$running = docker ps | Select-String $CONTAINER_NAME
if (-not $running) {
    Write-Host "❌ Container nao esta rodando!" -ForegroundColor Red
    exit 1
}

# Criar backup
Write-Host "💾 Criando backup..." -ForegroundColor Blue
if (-not (Test-Path "./backups")) {
    New-Item -ItemType Directory -Path "./backups" | Out-Null
}

$backupFile = "./backups/emergency_backup_$TIMESTAMP.sql"
try {
    docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > $backupFile
    Compress-Archive -Path $backupFile -DestinationPath "$backupFile.gz" -Force
    Remove-Item $backupFile
    Write-Host "✅ Backup criado" -ForegroundColor Green
}
catch {
    Write-Host "❌ Falha no backup!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔥 INICIANDO APAGAMENTO..." -ForegroundColor Red

# Criar arquivo SQL
$sqlFile = "temp_wipe.sql"
$sql = @"
BEGIN;
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
DELETE FROM users;
UPDATE system_config SET system_balance = 0, profit_pool = 0;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE quotas_id_seq RESTART WITH 1;
ALTER SEQUENCE loans_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
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
COMMIT;
ANALYZE;
"@

[System.IO.File]::WriteAllText($sqlFile, $sql)

try {
    # Executar comando Docker
    $cmd = "docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $sqlFile"
    cmd /c $cmd
    
    Write-Host ""
    Write-Host "✅ APAGAMENTO CONCLUIDO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 RESULTADO:" -ForegroundColor Red
    Write-Host "❌ BANCO 100% VAZIO" -ForegroundColor Red
    Write-Host "❌ TODOS OS DADOS APAGADOS" -ForegroundColor Red
    Write-Host "❌ INCLUSIVE O ADMIN" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔄 PROXIMOS PASSOS:" -ForegroundColor Blue
    Write-Host "1. Recriar banco:" -ForegroundColor Yellow
    Write-Host "   docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql" -ForegroundColor Green
    Write-Host ""
    Write-Host "2. Criar admin manual:" -ForegroundColor Yellow
    Write-Host "   docker exec -it cred30-postgres psql -U cred30user -d cred30" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "❌ FALHA NO APAGAMENTO!" -ForegroundColor Red
}
finally {
    if (Test-Path $sqlFile) {
        Remove-Item $sqlFile
    }
}

# Verificacao
Write-Host "🔍 Verificando..." -ForegroundColor Blue
try {
    $count = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;"
    Write-Host "Usuarios: $count" -ForegroundColor Blue
}
catch {
    Write-Host "Erro na verificacao" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Operacao concluida!" -ForegroundColor Green