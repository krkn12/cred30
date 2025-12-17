# Script simplificado para criar tabelas faltantes - PowerShell

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "CRIAÇÃO DE TABELAS FALTANTES - POWERSHELL SIMPLIFICADO" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Docker
Write-Host "🔍 Verificando Docker..." -ForegroundColor Blue
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker não está rodando"
    }
}
catch {
    Write-Host "❌ Docker não está rodando" -ForegroundColor Red
    exit 1
}

# Verificar container PostgreSQL
Write-Host "🔍 Verificando container PostgreSQL..." -ForegroundColor Blue
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Where-Object { $_ -ne "" }

if ([string]::IsNullOrEmpty($postgresContainer)) {
    Write-Host "❌ Container PostgreSQL não encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Container encontrado: $postgresContainer" -ForegroundColor Green

# Tentar diferentes usuários
$dbUser = "postgres"
$dbName = "cred30"

# Testar conexão
try {
    docker exec $postgresContainer psql -U $dbUser -d $dbName -c "SELECT 1;" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $dbUser = "cred30user"
        docker exec $postgresContainer psql -U $dbUser -d $dbName -c "SELECT 1;" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível conectar ao banco"
        }
    }
}
catch {
    Write-Host "❌ Erro de conexão com o banco" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Conectado com usuário: $dbUser" -ForegroundColor Green

# Ler e executar o script SQL
$sqlFile = "create-missing-tables.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Arquivo SQL não encontrado: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Lendo script SQL..." -ForegroundColor Blue
$sqlContent = Get-Content $sqlFile -Raw

Write-Host "🚀 Executando script SQL..." -ForegroundColor Yellow

# Usar método alternativo para evitar problemas com redirecionamento
$tempFile = "temp_script.sql"
$sqlContent | Out-File -FilePath $tempFile -Encoding UTF8

# Copiar arquivo para o container
docker cp "$tempFile" "$($postgresContainer):/tmp/temp_script.sql"

# Executar dentro do container
docker exec $postgresContainer psql -U $dbUser -d $dbName -f /tmp/temp_script.sql

# Remover arquivo temporário
Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Script executado com sucesso!" -ForegroundColor Green
    
    # Verificar tabelas criadas
    Write-Host "📋 Verificando tabelas criadas..." -ForegroundColor Blue
    $tableCount = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    $tableCount = $tableCount -replace '\s+', ''
    
    Write-Host "📊 Total de tabelas: $tableCount" -ForegroundColor Cyan
    
    # Listar tabelas
    $tables = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    $tables = $tables -split "`n" | Where-Object { $_ -ne "" }
    
    Write-Host ""
    Write-Host "📋 Tabelas criadas:" -ForegroundColor Yellow
    foreach ($table in $tables) {
        Write-Host "  - $table" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "🎉 Criação de tabelas concluída com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔄 Próximos passos:" -ForegroundColor Blue
    Write-Host "1. Teste a aplicação frontend" -ForegroundColor Yellow
    Write-Host "2. Verifique os logs do backend" -ForegroundColor Yellow
    Write-Host "3. Execute testes de integração" -ForegroundColor Yellow
    
}
else {
    Write-Host "❌ Erro ao executar script SQL" -ForegroundColor Red
    Write-Host "Verifique o arquivo SQL e as permissões do banco" -ForegroundColor Red
    exit 1
}