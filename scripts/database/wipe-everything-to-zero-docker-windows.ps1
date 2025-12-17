# =============================================================================
# SCRIPT DE LIMPEZA COMPLETA - DEIXAR TUDO ZERADO - DOCKER WINDOWS
# =============================================================================
# ⚠️ AVISO EXTREMO: ESTE SCRIPT APAGARÁ 100% DE TODOS OS DADOS
# INCLUSIVE CONFIGURAÇÕES - DEIXARÁ O BANCO COMPLETAMENTE VAZIO
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
    Show-Step "Criando backup de segurança antes de apagar tudo..."
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = ".\backups"
    $backupFile = "$backupDir\cred30_backup_before_wipe_$timestamp.sql"
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
            Show-Success "Backup de segurança criado com sucesso!"
            
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

# Função para verificar se tabela está vazia
function Test-TableEmpty {
    param([string]$tableName)
    
    $count = docker exec $DOCKER_CONTAINER psql -U $DOCKER_USER -d $DOCKER_DB -t -c "SELECT COUNT(*) FROM $tableName" 2>&1
    
    if ($count -eq "0") {
        Write-Host "✅ Tabela $($tableName): VAZIA" -ForegroundColor $Green
        return $true
    }
    else {
        Write-Host "❌ Tabela $($tableName): ainda tem $($count) registros" -ForegroundColor $Red
        return $false
    }
}

# Função principal
function Main {
    Show-Banner "LIMPEZA COMPLETA - DEIXAR TUDO ZERADO - DOCKER WINDOWS"
    
    Show-Warning "ESTA OPERAÇÃO APAGARÁ 100% DE TODOS OS DADOS!"
    Show-Warning "INCLUSIVE CONFIGURAÇÕES DO SISTEMA!"
    Show-Warning "O BANCO FICARÁ COMPLETAMENTE VAZIO!"
    Show-Warning "NÃO HÁ COMO VOLTAR ATRÁS DEPOIS DE EXECUTAR!"
    
    Write-Host ""
    Write-Host "🔥 TUDO SERÁ APAGADO:" -ForegroundColor $Red
    Write-Host "• TODOS os usuários (inclusive administradores)" -ForegroundColor $Red
    Write-Host "• TODAS as transações financeiras" -ForegroundColor $Red
    Write-Host "• TODAS as cotas de investimento" -ForegroundColor $Red
    Write-Host "• TODOS os empréstimos e parcelas" -ForegroundColor $Red
    Write-Host "• TODOS os saques" -ForegroundColor $Red
    Write-Host "• TODAS as configurações do sistema" -ForegroundColor $Red
    Write-Host "• TODAS as sequências serão resetadas" -ForegroundColor $Red
    Write-Host ""
    Write-Host "🎯 RESULTADO FINAL:" -ForegroundColor $Green
    Write-Host "• BANCO 100% VAZIO" -ForegroundColor $Green
    Write-Host "• SISTEMA PRECISARÁ SER REINICIALIZADO" -ForegroundColor $Green
    Write-Host ""
    
    $confirmation = Read-Host "Digite 'APAGAR_TUDO' para prosseguir com a limpeza completa"
    
    if ($confirmation -ne "APAGAR_TUDO") {
        Write-Host "❌ Confirmação incorreta. Operação cancelada." -ForegroundColor $Red
        exit 1
    }
    
    Write-Host ""
    Show-Success "Confirmação recebida! Iniciando apagamento TOTAL..."
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
    
    # Passo 1: Criar backup de segurança
    if (-not (New-DatabaseBackup)) {
        Show-Warning "Não foi possível criar backup de segurança. Operação cancelada."
        exit 1
    }
    
    # Passo 2: Executar limpeza completa
    Show-Step "Executando limpeza COMPLETA - deixando tudo ZERADO..."
    
    if (Invoke-DockerSQL -scriptFile ".\scripts\database\wipe-everything-to-zero.sql") {
        Show-Success "Limpeza COMPLETA executada com sucesso!"
    }
    else {
        Show-Warning "Falha na execução da limpeza completa!"
        exit 1
    }
    
    # Passo 3: Verificar que tudo foi apagado
    Show-Step "Verificando que tudo foi ZERADO..."
    
    # Lista de tabelas para verificar
    $tableList = @("users", "quotas", "loans", "loan_installments", "transactions", "withdrawals", "app_settings")
    $allEmpty = $true
    
    foreach ($table in $tableList) {
        if (-not (Test-TableEmpty $table)) {
            $allEmpty = $false
        }
    }
    
    Write-Host ""
    
    if ($allEmpty) {
        Show-Success "Verificação concluída! Todas as tabelas estão vazias!"
    }
    else {
        Show-Warning "Falha na verificação! Algumas tabelas ainda têm dados!"
        exit 1
    }
    
    Write-Host ""
    Show-Banner "OPERAÇÃO CONCLUÍDA COM SUCESSO!"
    Show-Success "BANCO DE DADOS 100% ZERADO!"
    Write-Host "🎯 RESULTADO FINAL ALCANÇADO!" -ForegroundColor $Green
    Write-Host ""
    Write-Host "🔥 BANCO COMPLETAMENTE VAZIO!" -ForegroundColor $Red
    Write-Host "🔄 SISTEMA PRECISA SER REINICIALIZADO!" -ForegroundColor $Yellow
    Write-Host ""
    Write-Host "⚠️ AVISOS IMPORTANTES:" -ForegroundColor $Yellow
    Write-Host "• O backup de segurança foi salvo em ./backups/" -ForegroundColor $Yellow
    Write-Host "• Nenhuma funcionalidade estará disponível até a reconfiguração" -ForegroundColor $Yellow
    Write-Host "• Execute o script de inicialização para recriar o sistema" -ForegroundColor $Yellow
    Write-Host ""
    Write-Host "🔄 PRÓXIMOS PASSOS OBRIGATÓRIOS:" -ForegroundColor $Blue
    Write-Host "1. Execute o script de inicialização:" -ForegroundColor $Blue
    Write-Host "   docker exec -i $($DOCKER_CONTAINER) psql -U $($DOCKER_USER) -d $($DOCKER_DB) < scripts/database/init-db-fixed.sql" -ForegroundColor $Green
    Write-Host ""
    Write-Host "2. Crie o primeiro usuário administrador:" -ForegroundColor $Blue
    Write-Host "   - Acesse a aplicação" -ForegroundColor $Blue
    Write-Host "   - Faça o primeiro cadastro" -ForegroundColor $Blue
    Write-Host "   - Este usuário será o administrador principal" -ForegroundColor $Blue
    Write-Host ""
    Write-Host "3. Configure as configurações essenciais:" -ForegroundColor $Blue
    Write-Host "   - Preço das cotas, taxas de juros, etc." -ForegroundColor $Blue
    Write-Host ""
    Write-Host "🎉 SISTEMA ZERADO COM SUCESSO!" -ForegroundColor $Green
}

# Executar função principal
Main