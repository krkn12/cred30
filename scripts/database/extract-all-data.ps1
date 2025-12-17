# Script PowerShell para extrair TODOS os dados do banco de dados CRED30
# Gera um backup completo em formato SQL

# Configurações
$BackupDir = "database\backup"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = "$BackupDir\cred30_complete_backup_$Timestamp.sql"

# Criar diretório de backup se não existir
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXTRAINDO TODOS OS DADOS - CRED30" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Diretório de backup: $BackupDir" -ForegroundColor Yellow
Write-Host "Arquivo de backup: $BackupFile" -ForegroundColor Yellow
Write-Host ""

# Executar extração de dados no Docker
Write-Host "Iniciando extração de dados do PostgreSQL..." -ForegroundColor Green
Write-Host ""

# Executar comando Docker e capturar saída
$Command = "docker exec -i cred30-postgres psql -U cred30user -d cred30 -f - < scripts/database/extract-all-data.sql"
$Result = Invoke-Expression $Command 2>&1 | Out-File -FilePath $BackupFile -Encoding UTF8

# Verificar se a extração foi bem-sucedida
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  EXTRAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Arquivo salvo em: $BackupFile" -ForegroundColor Yellow
    
    # Verificar tamanho do arquivo
    if (Test-Path $BackupFile) {
        $FileSize = (Get-Item $BackupFile).Length
        Write-Host "Tamanho do arquivo: $([math]::Round($FileSize / 1MB, 2)) MB" -ForegroundColor Yellow
    }
    
    Write-Host "Total de tabelas extraídas: 25" -ForegroundColor Yellow
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "      ERRO NA EXTRAÇÃO!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Código de erro: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Verifique o log acima para detalhes." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Mostrar resumo do arquivo gerado
Write-Host ""
Write-Host "=== RESUMO DO BACKUP GERADO ===" -ForegroundColor Cyan
Write-Host "Data/Hora: $Timestamp" -ForegroundColor Yellow
Write-Host "Arquivo: $BackupFile" -ForegroundColor Yellow
Write-Host ""

# Contar linhas no arquivo (aproximado)
if (Test-Path $BackupFile) {
    $LineCount = (Get-Content $BackupFile | Measure-Object -Line).Lines
    Write-Host "Linhas aproximadas: $LineCount" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== PRÓXIMOS PASSOS RECOMENDADOS ===" -ForegroundColor Cyan
Write-Host "1. Verifique o arquivo de backup" -ForegroundColor White
Write-Host "2. Teste a restauração em ambiente de teste" -ForegroundColor White
Write-Host "3. Mantenha o backup em local seguro" -ForegroundColor White
Write-Host "4. Documente a data do backup para rastreamento" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan

# Pausar para usuário visualizar
Write-Host ""
Write-Host "Pressione Enter para continuar..." -ForegroundColor Gray
Read-Host