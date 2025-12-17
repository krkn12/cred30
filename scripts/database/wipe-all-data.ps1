# Script PowerShell para REMOVER TODOS os dados do banco de dados CRED30
# MANTÉM APENAS o admin principal e a estrutura das tabelas

# Cores para output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Cyan = "Cyan"
$Gray = "Gray"

Write-Host "========================================" -ForegroundColor $Cyan
Write-Host "  LIMPANDO TODOS OS DADOS - CRED30" -ForegroundColor $Cyan
Write-Host "========================================" -ForegroundColor $Cyan
Write-Host ""
Write-Host "ATENÇÃO: Esta operação é IRREVERSÍVEL!" -ForegroundColor $Red
Write-Host "Apenas o admin principal será mantido." -ForegroundColor $Yellow
Write-Host ""

# Confirmar operação
$Confirm = Read-Host "Tem certeza que deseja continuar? (S/N)"
if ($Confirm -ne "S") {
    Write-Host ""
    Write-Host "Operação cancelada pelo usuário." -ForegroundColor $Yellow
    exit 0
}

Write-Host ""
Write-Host "Iniciando limpeza completa do banco de dados..." -ForegroundColor $Green
Write-Host ""

# Executar script de limpeza no Docker
$Command = "docker exec -i cred30-postgres psql -U cred30user -d cred30 -f - < scripts/database/wipe-all-data.sql"
$Result = Invoke-Expression $Command 2>&1

# Verificar se a limpeza foi bem-sucedida
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $Green
    Write-Host "      LIMPEZA CONCLUÍDA COM SUCESSO!" -ForegroundColor $Green
    Write-Host "========================================" -ForegroundColor $Green
    Write-Host ""
    Write-Host "Status do banco:" -ForegroundColor $Yellow
    
    # Verificar se apenas o admin existe
    $AdminCount = docker exec -i cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users WHERE email = 'josiassm701@gmail.com';" 2>$null
    if ($AdminCount -eq 1) {
        Write-Host "✅ Admin principal mantido com sucesso" -ForegroundColor $Green
    }
    else {
        Write-Host "❌ Erro: Admin principal não encontrado" -ForegroundColor $Red
    }
    
    # Verificar se outras tabelas estão vazias
    $TablesToCheck = @("quotas", "loans", "transactions", "withdrawals", "notifications", "referrals")
    
    foreach ($Table in $TablesToCheck) {
        $Count = docker exec -i cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM $Table;" 2>$null
        if ($Count -eq 0) {
            Write-Host "✅ Tabela $Table limpa" -ForegroundColor $Green
        }
        else {
            Write-Host "❌ Erro: Tabela $Table ainda tem $Count registros" -ForegroundColor $Red
        }
    }
    
    Write-Host ""
    Write-Host "Configurações restauradas:" -ForegroundColor $Yellow
    Write-Host "✅ Sequências resetadas" -ForegroundColor $Green
    Write-Host "✅ Configurações padrão aplicadas" -ForegroundColor $Green
    Write-Host "✅ Sistema pronto para novo início" -ForegroundColor $Green
    
}
else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $Red
    Write-Host "         ERRO NA LIMPEZA!" -ForegroundColor $Red
    Write-Host "========================================" -ForegroundColor $Red
    Write-Host ""
    Write-Host "Código de erro: $LASTEXITCODE" -ForegroundColor $Red
    Write-Host "Verifique o log acima para detalhes." -ForegroundColor $Red
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "=== PRÓXIMOS PASSOS RECOMENDADOS ===" -ForegroundColor $Cyan
Write-Host "1. Reinicie o backend:" -ForegroundColor White
Write-Host "   bun run dev" -ForegroundColor $Gray
Write-Host ""
Write-Host "2. Reinicie o frontend (se necessário):" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor $Gray
Write-Host ""
Write-Host "3. Verifique o login do admin:" -ForegroundColor White
Write-Host "   Email: josiassm701@gmail.com" -ForegroundColor $Gray
Write-Host "   Senha: sua senha atual" -ForegroundColor $Gray
Write-Host ""
Write-Host "4. Teste o sistema com dados limpos:" -ForegroundColor White
Write-Host "   - Cadastre um novo usuário" -ForegroundColor $Gray
Write-Host "   - Faça login e teste as funcionalidades" -ForegroundColor $Gray
Write-Host "   - Verifique o dashboard administrativo" -ForegroundColor $Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor $Cyan

Write-Host ""
Write-Host "Pressione Enter para continuar..." -ForegroundColor $Gray
Read-Host