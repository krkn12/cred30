# =============================================================================
-- ZERAR CAIXA OPERACIONAL - POWERSHELL WINDOWS
-- =============================================================================
-- Este script zera APENAS o caixa operacional (R$ 1.299,20)
-- Mantém todos os outros dados intactos
-- =============================================================================

Write-Host "============================================================================" -ForegroundColor Blue
Write-Host "ZERAR CAIXA OPERACIONAL" -ForegroundColor Blue
Write-Host "============================================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "⚠️ ATENÇÃO: Este script irá ZERAR o caixa operacional!" -ForegroundColor Yellow
Write-Host "⚠️ Valor atual: R$ 1.299,20" -ForegroundColor Yellow
Write-Host "⚠️ Novo valor: R$ 0,00" -ForegroundColor Yellow
Write-Host "✅ Todos os outros dados serão mantidos intactos" -ForegroundColor Green
Write-Host ""
Write-Host "Para confirmar, digite: ZERAR_CAIXA" -ForegroundColor Yellow
Write-Host "Ou pressione Ctrl+C para cancelar" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Confirmação"

if ($confirmation -ne "ZERAR_CAIXA") {
    Write-Host "❌ Operação cancelada." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Iniciando zeramento do caixa operacional..." -ForegroundColor Green
Write-Host ""

# Comandos SQL para zerar apenas o caixa operacional
$sqlCommands = @"
BEGIN;

-- Verificar valor atual do caixa operacional
SELECT 'CAIXA OPERACIONAL ANTES:' as info, value::text as valor 
FROM app_settings 
WHERE key = 'operational_cash_balance';

-- Zerar o caixa operacional
UPDATE app_settings 
SET value = '0', updated_at = NOW() 
WHERE key = 'operational_cash_balance';

-- Verificar novo valor
SELECT 'CAIXA OPERACIONAL DEPOIS:' as info, value::text as valor 
FROM app_settings 
WHERE key = 'operational_cash_balance';

-- Registrar operação de zeramento no log
INSERT INTO admin_logs (admin_id, entity_type, entity_id, action, old_value, new_value, created_at)
SELECT 
    u.id,
    'app_settings',
    (SELECT id FROM app_settings WHERE key = 'operational_cash_balance'),
    'CAIXA_ZERADO',
    '1299.20',
    '0',
    NOW()
FROM users u 
WHERE u.email = 'josiassm701@gmail.com'
LIMIT 1;

COMMIT;

-- Verificação final
SELECT 'VERIFICAÇÃO FINAL:' as status, key, value::text as valor, updated_at
FROM app_settings 
WHERE key = 'operational_cash_balance';
"@

# Salvar comandos SQL em arquivo temporário
$tempSqlFile = "$env:TEMP\zerar_caixa_temp.sql"
$sqlCommands | Out-File -FilePath $tempSqlFile -Encoding UTF8

try {
    Write-Host "🔸 Executando zeramento do caixa operacional..." -ForegroundColor Yellow
    
    # Executar os comandos diretamente no Docker
    $result = docker exec -i cred30-postgres psql -U cred30user -d cred30 --file="$tempSqlFile"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ CAIXA OPERACIONAL ZERADO COM SUCESSO!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎯 RESULTADO:" -ForegroundColor Green
        Write-Host "✅ Caixa operacional: R$ 0,00" -ForegroundColor Green
        Write-Host "✅ Valor anterior: R$ 1.299,20" -ForegroundColor Green
        Write-Host "✅ Operação registrada no log" -ForegroundColor Green
        Write-Host "✅ Demais dados mantidos intactos" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Próximos passos:" -ForegroundColor Blue
        Write-Host "1. Atualize a página do admin" -ForegroundColor Yellow
        Write-Host "2. Verifique que o caixa mostra R$ 0,00" -ForegroundColor Yellow
        Write-Host "3. O sistema continua funcionando normalmente" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "❌ Falha no zeramento do caixa operacional!" -ForegroundColor Red
        exit 1
    }
} finally {
    # Limpar arquivo temporário
    if (Test-Path $tempSqlFile) {
        Remove-Item $tempSqlFile -Force
    }
}