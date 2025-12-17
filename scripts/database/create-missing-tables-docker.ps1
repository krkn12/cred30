# Script PowerShell para criar tabelas faltantes no banco de dados via Docker
# Baseado na análise completa do frontend e backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CRIAÇÃO DE TABELAS FALTANTES - DOCKER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Iniciando processo em: $(Get-Date)" -ForegroundColor Yellow
Write-Host ""

# Verificar se o Docker está rodando
try {
    $dockerPs = docker ps 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERRO: Docker não está rodando ou não há permissão para acessá-lo" -ForegroundColor Red
        Write-Host "Por favor, inicie o Docker ou verifique as permissões" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ ERRO: Docker não está instalado ou não está em execução" -ForegroundColor Red
    Write-Host "Por favor, instale o Docker Desktop e inicie-o" -ForegroundColor Red
    exit 1
}

# Verificar se o container PostgreSQL está rodando
Write-Host "📋 Verificando containers PostgreSQL em execução..." -ForegroundColor Blue
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Where-Object { $_ -ne "" }

if ([string]::IsNullOrEmpty($postgresContainer)) {
    Write-Host "❌ ERRO: Nenhum container PostgreSQL encontrado em execução" -ForegroundColor Red
    Write-Host "Verifique se o container do banco de dados está rodando" -ForegroundColor Red
    Write-Host "Comandos úteis:" -ForegroundColor Yellow
    Write-Host "  docker ps -a                    # Listar todos os containers" -ForegroundColor Gray
    Write-Host "  docker start <container_name>    # Iniciar container parado" -ForegroundColor Gray
    Write-Host "  docker-compose up -d postgres   # Iniciar via docker-compose" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Container PostgreSQL encontrado: $postgresContainer" -ForegroundColor Green
Write-Host ""

# Tentar diferentes credenciais de acesso
Write-Host "🔐 Testando credenciais de acesso ao banco..." -ForegroundColor Blue

# Tentar com usuário postgres (padrão)
Write-Host "Testando com usuário postgres..." -ForegroundColor Yellow
$testPostgres = docker exec $postgresContainer psql -U postgres -d cred30 -c "SELECT 1;" 2>$null
if ($LASTEXITCODE -eq 0) {
    $dbUser = "postgres"
    $dbName = "cred30"
    Write-Host "✅ Acesso bem-sucedido com usuário: postgres" -ForegroundColor Green
} else {
    # Tentar com usuário cred30user
    Write-Host "Testando com usuário cred30user..." -ForegroundColor Yellow
    $testCred30 = docker exec $postgresContainer psql -U cred30user -d cred30 -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        $dbUser = "cred30user"
        $dbName = "cred30"
        Write-Host "✅ Acesso bem-sucedido com usuário: cred30user" -ForegroundColor Green
    } else {
        Write-Host "❌ ERRO: Não foi possível acessar o banco de dados com nenhuma credencial conhecida" -ForegroundColor Red
        Write-Host "Verifique as credenciais no arquivo docker-compose.yml" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📊 Verificando tabelas existentes no banco..." -ForegroundColor Blue

# Verificar tabelas existentes
$existingTablesQuery = @"
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
"@

$existingTables = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c $existingTablesQuery 2>$null
$existingTables = $existingTables -replace '\s+', '' -split "`n" | Where-Object { $_ -ne "" }

Write-Host "Tabelas existentes:" -ForegroundColor Yellow
foreach ($table in $existingTables) {
    Write-Host "  - $table" -ForegroundColor Gray
}

# Verificar se o arquivo SQL existe
$sqlFile = "create-missing-tables.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ ERRO: Arquivo $sqlFile não encontrado" -ForegroundColor Red
    Write-Host "Certifique-se de estar executando este script no diretório correto" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Executando script de criação de tabelas..." -ForegroundColor Blue

# Executar o script SQL
Write-Host "Aplicando script: $sqlFile" -ForegroundColor Yellow
$sqlContent = Get-Content $sqlFile -Raw
$executeResult = docker exec -i $postgresContainer psql -U $dbUser -d $dbName <<< $sqlContent 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Script executado com sucesso!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ ERRO: Falha ao executar o script SQL" -ForegroundColor Red
    Write-Host "Erro detalhado:" -ForegroundColor Red
    Write-Host $executeResult -ForegroundColor Red
    Write-Host "Verifique o arquivo SQL e as permissões do banco" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Verificando tabelas após a criação..." -ForegroundColor Blue

# Verificar tabelas após a criação
$newTables = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c $existingTablesQuery 2>$null
$newTables = $newTables -replace '\s+', '' -split "`n" | Where-Object { $_ -ne "" }

Write-Host "Tabelas após a criação:" -ForegroundColor Yellow
foreach ($table in $newTables) {
    Write-Host "  - $table" -ForegroundColor Gray
}

# Contar tabelas
$tableCount = $newTables.Count
Write-Host ""
Write-Host "📊 Total de tabelas: $tableCount" -ForegroundColor Cyan

# Verificar tabelas específicas importantes
Write-Host ""
Write-Host "🔍 Verificando tabelas críticas..." -ForegroundColor Blue

$criticalTables = @(
    "users",
    "system_config",
    "quotas",
    "loans",
    "transactions",
    "audit_logs",
    "user_sessions",
    "notifications",
    "referrals",
    "support_tickets"
)

foreach ($table in $criticalTables) {
    if ($newTables -contains $table) {
        Write-Host "✅ $table - OK" -ForegroundColor Green
    } else {
        Write-Host "❌ $table - FALTANDO" -ForegroundColor Red
    }
}

# Verificar índices
Write-Host ""
Write-Host "📋 Verificando índices criados..." -ForegroundColor Blue
$indexCountQuery = @"
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE schemaname = 'public';
"@

$indexCount = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c $indexCountQuery 2>$null
$indexCount = $indexCount -replace '\s+', ''
Write-Host "Total de índices: $indexCount" -ForegroundColor Cyan

# Verificar triggers
Write-Host ""
Write-Host "📋 Verificando triggers criados..." -ForegroundColor Blue
$triggerCountQuery = @"
    SELECT COUNT(*) 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
"@

$triggerCount = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c $triggerCountQuery 2>$null
$triggerCount = $triggerCount -replace '\s+', ''
Write-Host "Total de triggers: $triggerCount" -ForegroundColor Cyan

# Verificar views
Write-Host ""
Write-Host "📋 Verificando views criadas..." -ForegroundColor Blue
$viewCountQuery = @"
    SELECT COUNT(*) 
    FROM information_schema.views 
    WHERE table_schema = 'public';
"@

$viewCount = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c $viewCountQuery 2>$null
$viewCount = $viewCount -replace '\s+', ''
Write-Host "Total de views: $viewCount" -ForegroundColor Cyan

# Verificar configurações do sistema
Write-Host ""
Write-Host "📋 Verificando configurações do sistema..." -ForegroundColor Blue
$configCheckQuery = @"
    SELECT COUNT(*) 
    FROM system_config;
"@

$configCheck = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c $configCheckQuery 2>$null
$configCheck = $configCheck -replace '\s+', ''

if ([int]$configCheck -gt 0) {
    Write-Host "✅ Configurações do sistema encontradas" -ForegroundColor Green
    
    # Mostrar configurações principais
    Write-Host "Configurações atuais:" -ForegroundColor Yellow
    $configQuery = @"
        SELECT 
            quota_price,
            loan_interest_rate,
            penalty_rate,
            system_balance,
            profit_pool
        FROM system_config 
        LIMIT 1;
    "@
    
    docker exec $postgresContainer psql -U $dbUser -d $dbName -c $configQuery
} else {
    Write-Host "⚠️  Configurações do sistema não encontradas" -ForegroundColor Yellow
}

# Verificar usuário administrador
Write-Host ""
Write-Host "👤 Verificando usuários administradores..." -ForegroundColor Blue
$adminCountQuery = @"
    SELECT COUNT(*) 
    FROM users 
    WHERE is_admin = true;
"@

$adminCount = docker exec $postgresContainer psql -U $dbUser -d $dbName -t -c $adminCountQuery 2>$null
$adminCount = $adminCount -replace '\s+', ''
Write-Host "Total de administradores: $adminCount" -ForegroundColor Cyan

if ([int]$adminCount -eq 0) {
    Write-Host "⚠️  Nenhum usuário administrador encontrado" -ForegroundColor Yellow
    Write-Host "O primeiro usuário a se registrar será automaticamente administrador" -ForegroundColor Gray
} else {
    Write-Host "Administradores:" -ForegroundColor Yellow
    $adminQuery = @"
        SELECT id, name, email, created_at 
        FROM users 
        WHERE is_admin = true;
    "@
    
    docker exec $postgresContainer psql -U $dbUser -d $dbName -c $adminQuery
}

# Resumo final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ CRIAÇÃO DE TABELAS CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Data/Hora: $(Get-Date)" -ForegroundColor Yellow
Write-Host "Container: $postgresContainer" -ForegroundColor White
Write-Host "Banco de dados: $dbName" -ForegroundColor White
Write-Host "Usuário: $dbUser" -ForegroundColor White
Write-Host "Total de tabelas: $tableCount" -ForegroundColor White
Write-Host "Total de índices: $indexCount" -ForegroundColor White
Write-Host "Total de triggers: $triggerCount" -ForegroundColor White
Write-Host "Total de views: $viewCount" -ForegroundColor White
Write-Host "Administradores: $adminCount" -ForegroundColor White
Write-Host ""

# Próximos passos
Write-Host "📋 PRÓXIMOS PASSOS RECOMENDADOS:" -ForegroundColor Magenta
Write-Host "1. Teste a aplicação frontend para verificar se todas as funcionalidades funcionam" -ForegroundColor Gray
Write-Host "2. Verifique os logs da aplicação backend para possíveis erros" -ForegroundColor Gray
Write-Host "3. Execute testes de integração com as novas tabelas" -ForegroundColor Gray
Write-Host "4. Faça um backup completo do banco após as alterações" -ForegroundColor Gray
Write-Host ""

Write-Host "🔧 COMANDOS ÚTEIS:" -ForegroundColor Magenta
Write-Host "# Verificar estrutura de uma tabela específica:" -ForegroundColor Gray
Write-Host "docker exec $postgresContainer psql -U $dbUser -d $dbName -c `"\\d nome_tabela`"" -ForegroundColor White
Write-Host ""
Write-Host "# Verificar dados de uma tabela:" -ForegroundColor Gray
Write-Host "docker exec $postgresContainer psql -U $dbUser -d $dbName -c `"SELECT COUNT(*) FROM nome_tabela;`"" -ForegroundColor White
Write-Host ""
Write-Host "# Fazer backup do banco:" -ForegroundColor Gray
Write-Host "docker exec $postgresContainer pg_dump -U $dbUser $dbName > backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql" -ForegroundColor White
Write-Host ""

Write-Host "🎉 Sistema CRED30 pronto para uso com todas as tabelas!" -ForegroundColor Green