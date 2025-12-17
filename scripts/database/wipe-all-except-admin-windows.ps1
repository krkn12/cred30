# =============================================================================
# SCRIPT DE LIMPEZA COMPLETA EXCETO ADMINISTRADOR - WINDOWS POWERSHELL
# =============================================================================
# ⚠️ AVISO EXTREMO: ESTE SCRIPT APAGARÁ 100% DE TODOS OS DADOS
# EXCETO O ADMINISTRADOR PRINCIPAL (josiassm701@gmail.com)
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
    Write-Host "🚨 $message 🚨" -ForegroundColor $Red
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

# Função para exibir etapas
function Show-Step {
    param([string]$message)
    Write-Host "🔸 $message" -ForegroundColor $Yellow
}

# Configurações do banco
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "cred30"
$DB_USER = "postgres"

# Caminho do PostgreSQL (ajuste conforme sua instalação)
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
    Show-Warning "PostgreSQL não encontrado! Por favor, instale o PostgreSQL ou adicione o psql.exe ao PATH."
    Write-Host "Locais verificados:" -ForegroundColor $Yellow
    foreach ($path in $POSTGRES_PATHS) {
        Write-Host "  - $path" -ForegroundColor $Yellow
    }
    Write-Host ""
    Write-Host "Soluções:" -ForegroundColor $Green
    Write-Host "1. Instale PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor $Green
    Write-Host "2. Adicione o diretório bin do PostgreSQL ao PATH do Windows" -ForegroundColor $Green
    Write-Host "3. Use o script alternativo com Docker (se disponível)" -ForegroundColor $Green
    exit 1
}

Show-Info "PostgreSQL encontrado em: $PSQL_PATH"

# Função para executar comando SQL
function Invoke-SQL {
    param([string]$sqlFile)
    
    $sqlContent = Get-Content $sqlFile -Raw
    
    try {
        & $PSQL_PATH -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $sqlContent 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        else {
            Write-Host "Erro ao executar SQL:" -ForegroundColor $Red
            return $false
        }
    }
    catch {
        Write-Host "Exceção ao executar SQL: $($_.Exception.Message)" -ForegroundColor $Red
        return $false
    }
}

# Função para criar backup
function New-DatabaseBackup {
    Show-Step "Criando backup completo do banco..."
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = ".\backups"
    $backupFile = "$backupDir\cred30_backup_$timestamp.sql"
    
    # Criar diretório de backup
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    
    try {
        # Criar backup
        $pgDumpPath = $PSQL_PATH -replace "psql\.exe$", "pg_dump.exe"
        if (Test-Path $pgDumpPath) {
            & $pgDumpPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --verbose --clean --no-acl --no-owner --format=custom --file=$backupFile
            
            if ($LASTEXITCODE -eq 0) {
                # Comprimir backup
                Compress-Archive -Path $backupFile -DestinationPath "$backupFile.zip" -Force
                Remove-Item $backupFile -Force
                
                Show-Success "Backup criado e compactado com sucesso!"
                Show-Info "Arquivo: $backupFile.zip"
                return $true
            }
        }
    }
    catch {
        Write-Host "Erro ao criar backup: $($_.Exception.Message)" -ForegroundColor $Red
    }
    
    Show-Warning "Falha ao criar backup!"
    return $false
}

# Função principal
function Main {
    Show-Banner "LIMPEZA COMPLETA EXCETO ADMINISTRADOR - WINDOWS"
    
    Show-Warning "ESTA OPERAÇÃO APAGARÁ 100% DOS DADOS EXCETO O ADMIN!"
    Show-Warning "NÃO HÁ COMO VOLTAR ATRÁS DEPOIS DE EXECUTAR!"
    
    Write-Host ""
    Write-Host "Dados que serão APAGADOS (100%):" -ForegroundColor $Red
    Write-Host "• TODOS os usuários EXCETO o administrador principal" -ForegroundColor $Red
    Write-Host "• TODAS as transações financeiras" -ForegroundColor $Red
    Write-Host "• TODAS as cotas de investimento" -ForegroundColor $Red
    Write-Host "• TODOS os empréstimos e parcelas" -ForegroundColor $Red
    Write-Host "• TODOS os saques" -ForegroundColor $Red
    Write-Host "• TODAS as configurações do sistema (serão recriadas)" -ForegroundColor $Red
    Write-Host ""
    Write-Host "ÚNICO dado que será PRESERVADO:" -ForegroundColor $Green
    Write-Host "• APENAS o administrador principal (josiassm701@gmail.com)" -ForegroundColor $Green
    Write-Host ""
    
    $confirmation = Read-Host "Digite 'CONFIRMAR' para prosseguir com a limpeza"
    
    if ($confirmation -ne "CONFIRMAR") {
        Write-Host "❌ Confirmação incorreta. Operação cancelada." -ForegroundColor $Red
        exit 1
    }
    
    Write-Host ""
    Show-Success "Confirmação recebida! Iniciando processo de limpeza..."
    Write-Host ""
    
    # Passo 1: Criar backup
    if (-not (New-DatabaseBackup)) {
        Show-Warning "Não foi possível criar backup. Operação cancelada por segurança."
        exit 1
    }
    
    # Passo 2: Executar limpeza
    Show-Step "Executando limpeza completa exceto administrador..."
    
    if (Invoke-SQL -sqlFile ".\scripts\database\wipe-all-except-admin.sql") {
        Show-Success "Limpeza executada com sucesso!"
    }
    else {
        Show-Warning "Falha na execução da limpeza!"
        exit 1
    }
    
    # Passo 3: Verificar resultados
    Show-Step "Verificando resultados da limpeza..."
    
    if (Invoke-SQL -sqlFile ".\scripts\database\verify-cleanup.sql") {
        Show-Success "Verificação concluída!"
    }
    else {
        Show-Warning "Falha na verificação da limpeza!"
        exit 1
    }
    
    Write-Host ""
    Show-Banner "OPERAÇÃO CONCLUÍDA COM SUCESSO!"
    Show-Success "Limpeza completa exceto administrador concluída!"
    Write-Host "🔒 O sistema está pronto para operação com apenas o administrador!" -ForegroundColor $Green
    Write-Host ""
    Write-Host "Para testar o acesso:" -ForegroundColor $Yellow
    Write-Host "1. Acesse a interface da aplicação" -ForegroundColor $Yellow
    Write-Host "2. Faça login com: josiassm701@gmail.com" -ForegroundColor $Yellow
    Write-Host "3. Verifique o painel administrativo vazio" -ForegroundColor $Yellow
}

# Executar função principal
Main