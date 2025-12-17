# =============================================================================
# SCRIPT DE VERIFICAÇÃO PÓS-LIMPEZA - WINDOWS POWERSHELL
# =============================================================================

# Cores para PowerShell
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

# Função para exibir banners
function Show-Banner {
    param([string]$text)
    Write-Host "============================================================================" -ForegroundColor $Blue
    Write-Host $text -ForegroundColor $Blue
    Write-Host "============================================================================" -ForegroundColor $Blue
    Write-Host ""
}

# Função para exibir avisos
function Show-Warning {
    param([string]$message)
    Write-Host "🚨 $message" -ForegroundColor $Red
    Write-Host ""
}

# Função para exibir sucesso
function Show-Success {
    param([string]$message)
    Write-Host "✅ $message" -ForegroundColor $Green
}

# Função para exibir informações
function Show-Info {
    param([string]$message)
    Write-Host "ℹ️  $message" -ForegroundColor $Blue
}

# Configurações do banco
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "cred30"
$DB_USER = "postgres"

# Caminhos possíveis do PostgreSQL
$POSTGRES_PATHS = @(
    "C:\Program Files\PostgreSQL\*\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe",
    "C:\PostgreSQL\*\bin\psql.exe"
)

# Encontrar psql.exe
$PSQL_PATH = $null
foreach ($path in $POSTGRES_PATHS) {
    $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($found) {
        $PSQL_PATH = $found.FullName
        break
    }
}

if (-not $PSQL_PATH) {
    Show-Warning "PostgreSQL não encontrado! Por favor, instale o PostgreSQL."
    exit 1
}

Show-Info "PostgreSQL encontrado em: $PSQL_PATH"

# Função para executar consulta SQL
function Invoke-SQLQuery {
    param([string]$query)
    
    try {
        $result = & $PSQL_PATH -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $query -t -A 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $result.Trim()
        }
        else {
            return $null
        }
    }
    catch {
        return $null
    }
}

# Função para executar script SQL completo
function Invoke-SQLScript {
    param([string]$scriptFile)
    
    try {
        $scriptContent = Get-Content $scriptFile -Raw
        & $PSQL_PATH -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $scriptContent 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

# Função principal
function Main {
    Show-Banner "VERIFICAÇÃO PÓS-LIMPEZA - WINDOWS"
    
    Show-Info "Iniciando verificação pós-limpeza..."
    Write-Host ""
    
    # Verificar contagem de registros
    Show-Info "Verificando contagem de registros em todas as tabelas..."
    
    $tables = @(
        @{Name = "users"; Expected = 1 },
        @{Name = "quotas"; Expected = 0 },
        @{Name = "loans"; Expected = 0 },
        @{Name = "loan_installments"; Expected = 0 },
        @{Name = "transactions"; Expected = 0 },
        @{Name = "withdrawals"; Expected = 0 },
        @{Name = "app_settings"; Expected = 6 }
    )
    
    $allGood = $true
    
    foreach ($table in $tables) {
        $count = Invoke-SQLQuery "SELECT COUNT(*) FROM $($table.Name)"
        $status = if ($count -eq $table.Expected) { "✅ OK" } else { "❌ ERRO" }
        $color = if ($count -eq $table.Expected) { $Green } else { $Red }
        
        Write-Host "  $($table.Name): $count registros (esperado: $($table.Expected)) $status" -ForegroundColor $color
        
        if ($count -ne $table.Expected) {
            $allGood = $false
        }
    }
    
    Write-Host ""
    
    # Verificar administrador específico
    Show-Info "Verificando administrador principal..."
    
    $adminCount = Invoke-SQLQuery "SELECT COUNT(*) FROM users WHERE email = 'josiassm701@gmail.com' AND is_admin = TRUE"
    $adminEmail = Invoke-SQLQuery "SELECT email FROM users WHERE is_admin = TRUE LIMIT 1"
    $totalUsers = Invoke-SQLQuery "SELECT COUNT(*) FROM users"
    
    if ($adminCount -eq 1 -and $totalUsers -eq 1) {
        Show-Success "Administrador principal preservado corretamente: $adminEmail"
    }
    else {
        Show-Warning "Problema com administrador! Total: $totalUsers, Admin: $adminCount"
        $allGood = $false
    }
    
    Write-Host ""
    
    # Verificar configurações essenciais
    Show-Info "Verificando configurações essenciais..."
    
    $essentialSettings = @('quota_price', 'loan_interest_rate', 'penalty_rate', 'admin_pix_key', 'min_loan_amount', 'max_loan_amount')
    $settingsFound = 0
    
    foreach ($setting in $essentialSettings) {
        $value = Invoke-SQLQuery "SELECT value FROM app_settings WHERE key = '$setting'"
        if ($value) {
            Write-Host "  ✅ $setting = $value" -ForegroundColor $Green
            $settingsFound++
        }
        else {
            Write-Host "  ❌ $setting = NÃO ENCONTRADO" -ForegroundColor $Red
            $allGood = $false
        }
    }
    
    Write-Host ""
    
    # Verificar integridade referencial
    Show-Info "Verificando integridade referencial..."
    
    $orphanChecks = @(
        @{Name = "quotas"; Query = "SELECT COUNT(*) FROM quotas q LEFT JOIN users u ON q.user_id = u.id WHERE u.id IS NULL" },
        @{Name = "loans"; Query = "SELECT COUNT(*) FROM loans l LEFT JOIN users u ON l.user_id = u.id WHERE u.id IS NULL" },
        @{Name = "transactions"; Query = "SELECT COUNT(*) FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE u.id IS NULL" },
        @{Name = "withdrawals"; Query = "SELECT COUNT(*) FROM withdrawals w LEFT JOIN users u ON w.user_id = u.id WHERE u.id IS NULL" }
    )
    
    foreach ($check in $orphanChecks) {
        $orphanCount = Invoke-SQLQuery $check.Query
        if ($orphanCount -eq 0) {
            Write-Host "  ✅ Sem registros órfãos em $($check.Name)" -ForegroundColor $Green
        }
        else {
            Write-Host "  ❌ Encontrados $orphanCount registros órfãos em $($check.Name)" -ForegroundColor $Red
            $allGood = $false
        }
    }
    
    Write-Host ""
    
    # Resumo final
    Show-Banner "RESUMO DA VERIFICAÇÃO"
    
    if ($allGood) {
        Write-Host "🎉 SISTEMA EM ESTADO PERFEITO!" -ForegroundColor $Green
        Write-Host ""
        Write-Host "✅ Apenas o administrador principal está presente" -ForegroundColor $Green
        Write-Host "✅ Todas as tabelas de dados estão vazias" -ForegroundColor $Green
        Write-Host "✅ Configurações essenciais presentes" -ForegroundColor $Green
        Write-Host "✅ Integridade referencial mantida" -ForegroundColor $Green
        Write-Host ""
        Write-Host "🔒 Sistema pronto para operação segura!" -ForegroundColor $Green
        Write-Host ""
        Write-Host "Para testar o acesso:" -ForegroundColor $Yellow
        Write-Host "1. Acesse a interface da aplicação" -ForegroundColor $Yellow
        Write-Host "2. Faça login com: josiassm701@gmail.com" -ForegroundColor $Yellow
        Write-Host "3. Verifique o painel administrativo" -ForegroundColor $Yellow
    }
    else {
        Write-Host "❌ SISTEMA EM ESTADO INCONSISTENTE!" -ForegroundColor $Red
        Write-Host ""
        Write-Host "Problemas encontrados:" -ForegroundColor $Red
        Write-Host "• Verifique os detalhes acima" -ForegroundColor $Red
        Write-Host "• Execute os scripts de correção se necessário" -ForegroundColor $Red
        Write-Host "• Considere restaurar do backup" -ForegroundColor $Red
    }
    
    Write-Host ""
    Show-Info "Verificação concluída!"
}

# Executar função principal
Main