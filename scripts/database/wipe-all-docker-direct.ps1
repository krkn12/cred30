# =============================================================================
# LIMPEZA COMPLETA DIRETA NO DOCKER - POWERSHELL WINDOWS
# =============================================================================

Write-Host "============================================================================" -ForegroundColor Red
Write-Host "LIMPEZA COMPLETA DIRETA NO DOCKER - TUDO SERÁ APAGADO" -ForegroundColor Red
Write-Host "============================================================================" -ForegroundColor Red
Write-Host ""
Write-Host "🚨 ATENÇÃO: ESTE COMANDO APAGARÁ 100% DE TODOS OS DADOS! 🚨" -ForegroundColor Red
Write-Host "🚨 INCLUSIVE O ADMINISTRADOR E TODAS AS CONFIGURAÇÕES! 🚨" -ForegroundColor Red
Write-Host "🚨 O BANCO FICARÁ COMPLETAMENTE VAZIO! 🚨" -ForegroundColor Red
Write-Host ""
Write-Host "Para confirmar, digite: APAGAR_TUDO" -ForegroundColor Yellow
Write-Host "Ou pressione Ctrl+C para cancelar" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Confirmação"

if ($confirmation -ne "APAGAR_TUDO") {
    Write-Host "❌ Operação cancelada." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Iniciando apagamento TOTAL..." -ForegroundColor Green
Write-Host ""

# Comandos SQL diretos para apagar tudo
$sqlCommands = @"
-- Desabilitar constraints
SET session_replication_role = replica;

-- Apagar todos os dados de todas as tabelas
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE quotas RESTART IDENTITY CASCADE;
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE;
TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE;

-- Reabilitar constraints
SET session_replication_role = DEFAULT;

-- Resetar todas as sequências
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'ALTER SEQUENCE ' || r.sequence_name || ' RESTART WITH 1';
    END LOOP;
END
\$\$;

-- Verificar que tudo está vazio
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'quotas' as table_name, COUNT(*) as count FROM quotas
UNION ALL
SELECT 'loans' as table_name, COUNT(*) as count FROM loans
UNION ALL
SELECT 'loan_installments' as table_name, COUNT(*) as count FROM loan_installments
UNION ALL
SELECT 'transactions' as table_name, COUNT(*) as count FROM transactions
UNION ALL
SELECT 'withdrawals' as table_name, COUNT(*) as count FROM withdrawals
UNION ALL
SELECT 'app_settings' as table_name, COUNT(*) as count FROM app_settings;
"@

# Salvar comandos SQL em arquivo temporário
$tempSqlFile = "$env:TEMP\wipe_cred30_temp.sql"
$sqlCommands | Out-File -FilePath $tempSqlFile -Encoding UTF8

try {
    Write-Host "🔸 Executando limpeza completa..." -ForegroundColor Yellow
    
    # Executar os comandos diretamente no Docker
    $result = docker exec -i cred30-postgres psql -U cred30user -d cred30 --file="$tempSqlFile"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ LIMPEZA COMPLETA REALIZADA COM SUCESSO!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎯 RESULTADO:" -ForegroundColor Red
        Write-Host "✅ BANCO 100% VAZIO" -ForegroundColor Red
        Write-Host "✅ TODOS OS DADOS APAGADOS" -ForegroundColor Red
        Write-Host "✅ SISTEMA PRECISA SER REINICIALIZADO" -ForegroundColor Red
        Write-Host ""
        Write-Host "🔄 PRÓXIMOS PASSOS:" -ForegroundColor Blue
        Write-Host "1. Para recriar o banco:" -ForegroundColor Yellow
        Write-Host "   docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql" -ForegroundColor Green
        Write-Host "2. Acesse a aplicação e crie o primeiro admin" -ForegroundColor Yellow
        Write-Host ""
    }
    else {
        Write-Host "❌ Falha na execução da limpeza!" -ForegroundColor Red
        exit 1
    }
}
finally {
    # Limpar arquivo temporário
    if (Test-Path $tempSqlFile) {
        Remove-Item $tempSqlFile -Force
    }
}