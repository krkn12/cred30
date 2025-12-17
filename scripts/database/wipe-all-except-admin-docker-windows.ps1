# =============================================================================
# SCRIPT DE LIMPEZA COMPLETA EXCETO ADMINISTRADOR - DOCKER WINDOWS
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

# Configurações do Docker
$DOCKER_CONTAINER = $env:DOCKER_CONTAINER
if (-not $DOCKER_CONTAINER) {
    $DOCKER_CONTAINER = "cred30-postgres"
}

$DOCKER_DB = $env:DOCKER_DB
if (-not $DOCKER_DB) {
    $DOCKER_DB = "cred30"
}

$DOCKER_USER = $env:DOCKER_USER
if (-not $DOCKER_USER) {
    $DOCKER_USER = "postgres"
}

# Função para executar comando Docker
function Invoke-DockerCommand {
    param([string]$command, [switch]$ignoreError = $false)
    
    try {
        if ($ignoreError) {
            docker exec $DOCKER_CONTAINER $command 2>&1 | Out-Null
        }
        else {
            $result = docker exec $DOCKER_CONTAINER $command 2>&1
            return $result
        }
        
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        else {
            return $false
        }
    }
    catch {
        if ($ignoreError) {
            return $true
        }
        else {
            return $false
        }
    }
}

# Função para executar script SQL via Docker
function Invoke-DockerSQL {
    param([string]$scriptFile)
    
    try {
        $scriptContent = Get-Content $scriptFile -Raw
        docker exec -i $DOCKER_CONTAINER psql -U $DOCKER_USER -d $DOCKER_DB -c $scriptContent 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

# Função para criar backup
function New-DatabaseBackup {
    Show-Step "Criando backup completo do banco..."
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = ".\backups"
    $backupFile = "$backupDir\cred30_backup_$timestamp.sql"
    $backupCompressed = "$backupFile.gz"
    
    # Criar diretório de backup
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    
    try {
        # Criar backup usando Docker
        $result = docker exec $DOCKER_CONTAINER pg_dump -U $DOCKER_USER -d $DOCKER_DB --verbose --clean --no-acl --no-owner 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Set-Content -Path $backupFile -Value $result -Encoding UTF8
            Show-Success "Backup criado com sucesso!"
            
            # Comprimir o backup
            Show-Info "Comprimindo backup..."
            Compress-Archive -Path $backupFile -DestinationPath $backupCompressed -Force
            Remove-Item $backupFile -Force
            
            if (Test-Path $backupCompressed) {
                Show-Success "Backup comprimido com sucesso!"
                Show-Info "Arquivo: $backupCompressed"
                
                # Mostrar tamanho do arquivo
                $fileInfo = Get-Item $backupCompressed
                $fileSize = [math]::Round($fileInfo.Length / 1MB, 2)
                Show-Info "Tamanho: $fileSize MB"
                
                return $true
            }
        }
    }
    catch {
        Show-Warning "Erro ao criar backup: $($_.Exception.Message)"
    }
    
    Show-Warning "Falha ao criar backup!"
    return $false
}

# Função principal
function Main {
    Show-Banner "LIMPEZA COMPLETA EXCETO ADMINISTRADOR - DOCKER WINDOWS"
    
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
    
    # Verificar se o container está rodando
    Show-Step "Verificando container Docker..."
    $containerRunning = docker ps | Select-String $DOCKER_CONTAINER -Quiet
    
    if (-not $containerRunning) {
        Show-Warning "Container Docker '$DOCKER_CONTAINER' não está rodando!"
        Write-Host "Verifique:" -ForegroundColor $Red
        Write-Host "• docker ps" -ForegroundColor $Red
        Write-Host "• docker start $DOCKER_CONTAINER" -ForegroundColor $Red
        exit 1
    }
    
    Show-Success "Container Docker encontrado e rodando!"
    
    # Passo 1: Criar backup
    if (-not (New-DatabaseBackup)) {
        Show-Warning "Não foi possível criar backup. Operação cancelada por segurança."
        exit 1
    }
    
    # Passo 2: Executar limpeza
    Show-Step "Executando limpeza completa exceto administrador..."
    
    if (Invoke-DockerSQL -scriptFile ".\scripts\database\wipe-all-except-admin.sql") {
        Show-Success "Limpeza executada com sucesso!"
    }
    else {
        Show-Warning "Falha na execução da limpeza!"
        exit 1
    }
    
    # Passo 3: Verificar resultados
    Show-Step "Verificando resultados da limpeza..."
    
    if (Invoke-DockerSQL -scriptFile ".\scripts\database\verify-cleanup.sql") {
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