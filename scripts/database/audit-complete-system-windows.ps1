# =====================================================
# AUDITORIA COMPLETA DO SISTEMA CRED30 - POWERSHELL
# =====================================================
# Verifica frontend, backend e banco de dados no Docker
# =====================================================

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "AUDITORIA COMPLETA DO SISTEMA CRED30 - POWERSHELL" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Função para verificar status
function Write-Status {
    param($Message, $Status)
    $color = if ($Status -eq "OK") { "Green" } elseif ($Status -eq "ERROR") { "Red" } elseif ($Status -eq "WARNING") { "Yellow" } else { "White" }
    Write-Host $Message -ForegroundColor $color
}

# [1/6] Verificando status dos containers Docker
Write-Host "[1/6] Verificando status dos containers Docker..." -ForegroundColor Yellow
try {
    $containers = docker ps --format "table {{.Names}}`t{{.Status}}"
    Write-Host $containers -ForegroundColor White
    
    $backendRunning = $containers -match "cred30-backend-single.*Up"
    $frontendRunning = $containers -match "cred30-frontend-single.*Up"
    $postgresRunning = $containers -match "cred30-postgres.*Up"
    
    if ($backendRunning -and $frontendRunning -and $postgresRunning) {
        Write-Status "✓ Todos os containers estão rodando" "OK"
    } else {
        Write-Status "✗ Alguns containers não estão rodando" "ERROR"
        if (-not $backendRunning) { Write-Status "  - Backend não está rodando" "ERROR" }
        if (-not $frontendRunning) { Write-Status "  - Frontend não está rodando" "ERROR" }
        if (-not $postgresRunning) { Write-Status "  - PostgreSQL não está rodando" "ERROR" }
    }
} catch {
    Write-Status "✗ Erro ao verificar containers Docker" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""

# [2/6] Verificando banco de dados PostgreSQL
Write-Host "[2/6] Verificando banco de dados PostgreSQL..." -ForegroundColor Yellow
try {
    $tables = docker exec cred30-postgres psql -U cred30user -d cred30 -c @"
        SELECT 
            schemaname || '.' || tablename as tabela,
            COALESCE((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename), 0) as colunas
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY tablename;
    "@
    Write-Host $tables -ForegroundColor White
    
    $userCount = docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) FROM users;" -ErrorAction SilentlyContinue
    if ($userCount -match "0") {
        Write-Status "✓ Banco de dados vazio (limpo)" "OK"
    } else {
        Write-Status "ℹ Banco de dados com $userCount usuários" "WARNING"
    }
} catch {
    Write-Status "✗ Erro ao verificar banco de dados" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""

# [3/6] Verificando usuários no banco de dados
Write-Host "[3/6] Verificando usuários no banco de dados..." -ForegroundColor Yellow
try {
    $users = docker exec cred30-postgres psql -U cred30user -d cred30 -c @"
        SELECT 
            id, 
            email, 
            name, 
            is_admin, 
            role, 
            balance, 
            created_at,
            CASE WHEN is_admin THEN 'ADMIN' ELSE 'CLIENTE' END as tipo_usuario
        FROM users 
        ORDER BY created_at DESC;
    "@
    Write-Host $users -ForegroundColor White
    
    $adminCount = docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) FROM users WHERE is_admin = true;" -ErrorAction SilentlyContinue
    if ($adminCount -match "0") {
        Write-Status "ℹ Nenhum usuário admin encontrado" "WARNING"
    } else {
        Write-Status "✓ $adminCount usuário(s) admin encontrado(s)" "OK"
    }
} catch {
    Write-Status "✗ Erro ao verificar usuários" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""

# [4/6] Verificando configurações do sistema
Write-Host "[4/6] Verificando configurações do sistema..." -ForegroundColor Yellow
try {
    $config = docker exec cred30-postgres psql -U cred30user -d cred30 -c @"
        SELECT 
            system_balance,
            profit_pool,
            quota_price,
            loan_interest_rate,
            penalty_rate,
            vesting_period_ms,
            created_at
        FROM system_config 
        ORDER BY created_at DESC 
        LIMIT 1;
    "@
    Write-Host $config -ForegroundColor White
} catch {
    Write-Status "✗ Erro ao verificar configurações do sistema" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""

# [5/6] Verificando transações recentes
Write-Host "[5/6] Verificando transações recentes..." -ForegroundColor Yellow
try {
    $transactions = docker exec cred30-postgres psql -U cred30user -d cred30 -c @"
        SELECT 
            t.id,
            t.type,
            t.amount,
            t.status,
            t.created_at,
            u.email as user_email,
            u.name as user_name
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC 
        LIMIT 10;
    "@
    Write-Host $transactions -ForegroundColor White
    
    $pendingCount = docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) FROM transactions WHERE status = 'PENDING';" -ErrorAction SilentlyContinue
    if ($pendingCount -match "0") {
        Write-Status "✓ Nenhuma transação pendente" "OK"
    } else {
        Write-Status "ℹ $pendingCount transação(ões) pendente(s)" "WARNING"
    }
} catch {
    Write-Status "✗ Erro ao verificar transações" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""

# [6/6] Verificando logs de erros
Write-Host "[6/6] Verificando logs de erros..." -ForegroundColor Yellow

try {
    Write-Host "Verificando logs do backend (últimas 20 linhas)..." -ForegroundColor Cyan
    $backendLogs = docker logs cred30-backend-single --tail=20 --since=1h 2>$null
    if ($backendLogs) {
        Write-Host $backendLogs -ForegroundColor White
        if ($backendLogs -match "ERROR" -or $backendLogs -match "Error" -or $backendLogs -match "error") {
            Write-Status "✗ Encontrados erros no backend" "ERROR"
        } else {
            Write-Status "✓ Nenhum erro encontrado no backend" "OK"
        }
    } else {
        Write-Status "ℹ Nenhum log recente no backend" "WARNING"
    }
} catch {
    Write-Status "✗ Erro ao verificar logs do backend" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""

try {
    Write-Host "Verificando logs do frontend (últimas 20 linhas)..." -ForegroundColor Cyan
    $frontendLogs = docker logs cred30-frontend-single --tail=20 --since=1h 2>$null
    if ($frontendLogs) {
        Write-Host $frontendLogs -ForegroundColor White
        if ($frontendLogs -match "ERROR" -or $frontendLogs -match "Error" -or $frontendLogs -match "error") {
            Write-Status "✗ Encontrados erros no frontend" "ERROR"
        } else {
            Write-Status "✓ Nenhum erro encontrado no frontend" "OK"
        }
    } else {
        Write-Status "ℹ Nenhum log recente no frontend" "WARNING"
    }
} catch {
    Write-Status "✗ Erro ao verificar logs do frontend" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""

try {
    Write-Host "Verificando logs do PostgreSQL (últimas 20 linhas)..." -ForegroundColor Cyan
    $postgresLogs = docker logs cred30-postgres --tail=20 --since=1h 2>$null
    if ($postgresLogs) {
        Write-Host $postgresLogs -ForegroundColor White
        if ($postgresLogs -match "ERROR" -or $postgresLogs -match "Error" -or $postgresLogs -match "error") {
            Write-Status "✗ Encontrados erros no PostgreSQL" "ERROR"
        } else {
            Write-Status "✓ Nenhum erro encontrado no PostgreSQL" "OK"
        }
    } else {
        Write-Status "ℹ Nenhum log recente no PostgreSQL" "WARNING"
    }
} catch {
    Write-Status "✗ Erro ao verificar logs do PostgreSQL" "ERROR"
    Write-Host $_ -ForegroundColor Red
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "AUDITORIA CONCLUÍDA!" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "RESUMO DA AUDITORIA:" -ForegroundColor Yellow
Write-Host "1. Containers Docker: Verifique se todos estão 'Up'" -ForegroundColor White
Write-Host "2. Banco de Dados: Verifique estrutura e contagem de registros" -ForegroundColor White
Write-Host "3. Usuários: Verifique se existem usuários cadastrados" -ForegroundColor White
Write-Host "4. Configurações: Verifique valores do sistema" -ForegroundColor White
Write-Host "5. Transações: Verifique operações recentes" -ForegroundColor White
Write-Host "6. Logs: Verifique se há erros ou warnings" -ForegroundColor White
Write-Host ""
Write-Host "Se tudo estiver correto, o sistema está pronto para uso!" -ForegroundColor Green
Write-Host ""
Read-Host "Pressione Enter para sair..."