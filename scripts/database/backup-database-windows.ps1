# =============================================================================
# SCRIPT DE BACKUP COMPLETO DO BANCO DE DADOS - WINDOWS POWERSHELL
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
    Show-Warning "PostgreSQL não encontrado! Por favor, instale o PostgreSQL ou adicione o psql.exe ao PATH."
    Write-Host "Locais verificados:" -ForegroundColor $Yellow
    foreach ($path in $POSTGRES_PATHS) {
        Write-Host "  - $path" -ForegroundColor $Yellow
    }
    Write-Host ""
    Write-Host "Soluções:" -ForegroundColor $Green
    Write-Host "1. Instale PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor $Green
    Write-Host "2. Adicione o diretório bin do PostgreSQL ao PATH do Windows" -ForegroundColor $Green
    exit 1
}

Show-Info "PostgreSQL encontrado em: $PSQL_PATH"

# Criar diretório de backup
$backupDir = ".\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\cred30_backup_$timestamp.sql"
$backupCompressed = "$backupFile.zip"

Show-Banner "INICIANDO BACKUP COMPLETO DO BANCO DE DADOS CRED30"

Write-Host "Configurações do backup:" -ForegroundColor $Yellow
Write-Host "  Host: $DB_HOST" -ForegroundColor $White
Write-Host "  Porta: $DB_PORT" -ForegroundColor $White
Write-Host "  Banco: $DB_NAME" -ForegroundColor $White
Write-Host "  Usuário: $DB_USER" -ForegroundColor $White
Write-Host "  Arquivo: $backupCompressed" -ForegroundColor $White
Write-Host ""

# Testar conexão
Show-Info "Testando conexão com o banco..."
try {
    & $PSQL_PATH -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Show-Success "Conexão bem-sucedida!"
    }
    else {
        Show-Warning "Falha na conexão com o banco de dados!"
        Write-Host "Verifique as configurações de conexão." -ForegroundColor $Red
        exit 1
    }
}
catch {
    Show-Warning "Erro ao testar conexão: $($_.Exception.Message)"
    exit 1
}

# Criar backup
Show-Info "Criando backup completo..."
Write-Host "Isso pode levar alguns minutos, dependendo do tamanho do banco..." -ForegroundColor $Yellow

try {
    $pgDumpPath = $PSQL_PATH -replace "psql\.exe$", "pg_dump.exe"
    
    if (Test-Path $pgDumpPath) {
        # Criar backup
        & $pgDumpPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --verbose --clean --no-acl --no-owner --format=custom --file=$backupFile
        
        if ($LASTEXITCODE -eq 0) {
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
                
                # Listar backups anteriores
                Write-Host ""
                Write-Host "Backups anteriores:" -ForegroundColor $Blue
                $backups = Get-ChildItem "$backupDir\*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
                if ($backups) {
                    foreach ($backup in $backups) {
                        Write-Host "  $($backup.Name) ($([math]::Round($backup.Length / 1MB, 2)) MB)" -ForegroundColor $White
                    }
                }
                else {
                    Write-Host "  Nenhum backup anterior encontrado" -ForegroundColor $Yellow
                }
                
                Write-Host ""
                Write-Host "Para restaurar este backup, use:" -ForegroundColor $Yellow
                Write-Host "Expand-Archive -Path $backupCompressed -DestinationPath .\temp_restore" -ForegroundColor $Green
                Write-Host "& `"$PSQL_PATH`" -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f .\temp_restore\cred30_backup_$timestamp.sql" -ForegroundColor $Green
                
            }
            else {
                Show-Warning "Erro ao comprimir o backup!"
                exit 1
            }
        }
        else {
            Show-Warning "Erro ao criar backup!"
            Write-Host "Verifique:" -ForegroundColor $Red
            Write-Host "• Se o banco está acessível" -ForegroundColor $Red
            Write-Host "• Se tem permissão de leitura" -ForegroundColor $Red
            Write-Host "• Se há espaço em disco suficiente" -ForegroundColor $Red
            exit 1
        }
    }
    else {
        Show-Warning "pg_dump.exe não encontrado!"
        exit 1
    }
}
catch {
    Show-Warning "Exceção ao criar backup: $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Show-Success "Backup completo finalizado com sucesso!"
Show-Info "Mantenha este arquivo em local seguro!"