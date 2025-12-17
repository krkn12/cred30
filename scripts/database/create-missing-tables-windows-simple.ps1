# Versão simplificada para Windows - Criação de tabelas faltantes

# Cores
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "============================================================================" "Cyan"
Write-ColorOutput "CRIAÇÃO DE TABELAS FALTANTES - WINDOWS SIMPLIFICADO" "Cyan"
Write-ColorOutput "============================================================================" "Cyan"
Write-ColorOutput ""

# Verificar Docker
Write-ColorOutput "🔍 Verificando Docker..." "Blue"
try {
    $dockerTest = docker ps 2>$null
    $null = $dockerTest  # Usar a variável para evitar aviso
    if ($LASTEXITCODE -ne 0) {
        throw "Docker não está rodando"
    }
}
catch {
    Write-ColorOutput "❌ Docker não está rodando" "Red"
    exit 1
}

# Verificar container PostgreSQL
Write-ColorOutput "🔍 Verificando container PostgreSQL..." "Blue"
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Where-Object { $_ -ne "" }

if ([string]::IsNullOrEmpty($postgresContainer)) {
    Write-ColorOutput "❌ Container PostgreSQL não encontrado" "Red"
    exit 1
}

Write-ColorOutput "✅ Container encontrado: $postgresContainer" "Green"

# Tentar diferentes usuários
$dbUser = "postgres"
$dbName = "cred30"

# Testar conexão
try {
    $testResult = docker exec $postgresContainer psql -U $dbUser -d $dbName -c "SELECT 1;" 2>$null
    $null = $testResult  # Usar a variável para evitar aviso
    if ($LASTEXITCODE -ne 0) {
        $dbUser = "cred30user"
        $testResult = docker exec $postgresContainer psql -U $dbUser -d $dbName -c "SELECT 1;" 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível conectar ao banco"
        }
    }
}
catch {
    Write-ColorOutput "❌ Erro de conexão com o banco" "Red"
    exit 1
}

Write-ColorOutput "✅ Conectado com usuário: $dbUser" "Green"

# Ler e executar o script SQL
$sqlFile = "create-missing-tables.sql"
if (-not (Test-Path $sqlFile)) {
    Write-ColorOutput "❌ Arquivo SQL não encontrado: $sqlFile" "Red"
    exit 1
}

Write-ColorOutput "📋 Lendo script SQL..." "Blue"
$sqlContent = Get-Content $sqlFile -Raw

Write-ColorOutput "🚀 Executando script SQL..." "Yellow"

# Usar método alternativo para evitar problemas com redirecionamento
$tempFile = "temp_script.sql"
$sqlContent | Out-File -FilePath $tempFile -Encoding UTF8

# Copiar arquivo para o container
docker cp "$tempFile" "$($postgresContainer):/tmp/temp_script.sql"

# Executar dentro do container
$execResult = docker exec $postgresContainer psql -U $dbUser -d $dbName -f /tmp/temp_script.sql
$null = $execResult  # Usar a variável para evitar aviso

# Remover arquivo temporário
Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput ""
    Write-ColorOutput "✅ Script executado com sucesso!" "Green"
    
    # Verificar tabelas criadas
    Write-ColorOutput "📋 Verificando tabelas criadas..." "Blue"
    $tableCount = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>$null
    $tableCount = $tableCount -replace '\s+', ''
    
    Write-ColorOutput "📊 Total de tabelas: $tableCount" "Cyan"
    
    # Listar tabelas
    $tables = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name" 2>$null
    $tables = $tables -split "`n" | Where-Object { $_ -ne "" }
    
    Write-ColorOutput ""
    Write-ColorOutput "📋 Tabelas criadas:" "Yellow"
    foreach ($table in $tables) {
        Write-ColorOutput "  - $table" "Gray"
    }
    
    Write-ColorOutput ""
    Write-ColorOutput "🎉 Criação de tabelas concluída com sucesso!" "Green"
    Write-ColorOutput ""
    Write-ColorOutput "🔄 Próximos passos:" "Blue"
    Write-ColorOutput "1. Teste a aplicação frontend" "Yellow"
    Write-ColorOutput "2. Verifique os logs do backend" "Yellow"
    Write-ColorOutput "3. Execute testes de integração" "Yellow"
    
}
else {
    Write-ColorOutput "❌ Erro ao executar script SQL" "Red"
    Write-ColorOutput "Verifique o arquivo SQL e as permissões do banco" "Red"
    exit 1
}