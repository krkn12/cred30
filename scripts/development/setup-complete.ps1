# Script Completo de Setup do CRED30 para Desenvolvimento Local (Windows PowerShell)
# Este script configura tudo automaticamente: banco de dados, variáveis de ambiente e inicialização

Write-Host "🚀 Iniciando Setup Completo do CRED30 para Desenvolvimento Local" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green

# Função para imprimir mensagens coloridas
function Write-ColorOutput {
    param(
        [string]$Message,
        [ConsoleColor]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput -Message $Message -Color "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput -Message $Message -Color "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput -Message $Message -Color "Red"
}

function Write-Header {
    param([string]$Message)
    Write-ColorOutput -Message $Message -Color "Cyan"
}

# Verificar pré-requisitos
Write-Header "Verificando Pré-requisitos"

# Verificar Node.js
try {
    $NodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js encontrado: $NodeVersion"
    } else {
        throw "Node.js não encontrado"
    }
} catch {
    Write-Error "Node.js não encontrado. Por favor, instale de https://nodejs.org"
    exit 1
}

# Verificar npm
try {
    $NpmVersion = npm --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "npm encontrado: $NpmVersion"
    } else {
        throw "npm não encontrado"
    }
} catch {
    Write-Error "npm não encontrado. Por favor, instale Node.js (inclui npm)"
    exit 1
}

# Verificar PostgreSQL
$PostgresInstalled = $false
try {
    $PsqlVersion = psql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "PostgreSQL encontrado: $PsqlVersion"
        $PostgresInstalled = $true
    } else {
        throw "PostgreSQL não encontrado"
    }
} catch {
    Write-Warning "PostgreSQL não encontrado nativo. Será usado Docker"
    $PostgresInstalled = $false
}

# Verificar Git
try {
    $GitVersion = git --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Git encontrado: $GitVersion"
    } else {
        throw "Git não encontrado"
    }
} catch {
    Write-Error "Git não encontrado. Por favor, instale de https://git-scm.com"
    exit 1
}

Write-Host ""

# Instalar dependências
Write-Header "Instalando Dependências"

Write-Success "Instalando dependências do projeto principal..."
npm install

Write-Success "Instalando dependências do backend..."
Set-Location backend
npm install
Set-Location ..

Write-Host ""

# Configurar banco de dados
Write-Header "Configurando Banco de Dados"

if ($PostgresInstalled) {
    Write-Success "Configurando PostgreSQL nativo..."
    
    # Criar banco de dados
    Write-Success "Criando banco de dados 'cred30'..."
    createdb cred30 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Banco 'cred30' já existe"
    }
    
    # Criar usuário
    Write-Success "Criando usuário 'cred30user'..."
    createuser cred30user 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Usuário 'cred30user' já existe"
    }
    
    # Configurar permissões
    Write-Success "Configurando permissões..."
    psql -d postgres -c "ALTER USER cred30user WITH PASSWORD 'cred30pass';" 2>$null
    psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE cred30 TO cred30user;" 2>$null
    
    $DbHost = "localhost"
    Write-Success "PostgreSQL nativo configurado com sucesso!"
} else {
    Write-Success "Configurando PostgreSQL com Docker..."
    
    # Verificar Docker Desktop
    try {
        $DockerInfo = docker info 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker Desktop está rodando"
        } else {
            throw "Docker Desktop não está rodando"
        }
    } catch {
        Write-Error "Docker Desktop não encontrado. Por favor, instale de https://www.docker.com/products/docker-desktop"
        exit 1
    }
    
    # Criar docker-compose.yml
    Write-Success "Criando docker-compose.yml..."
    $DockerComposeContent = @"
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: cred30-postgres
    environment:
      POSTGRES_DB: cred30
      POSTGRES_USER: cred30user
      POSTGRES_PASSWORD: cred30pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
"@
    
    $DockerComposeContent | Out-File -FilePath "docker-compose.yml" -Encoding UTF8
    
    # Iniciar Docker
    Write-Success "Iniciando PostgreSQL com Docker..."
    docker compose up -d
    
    # Aguardar PostgreSQL iniciar
    Write-Success "Aguardando PostgreSQL inicializar..."
    Start-Sleep -Seconds 10
    
    $DbHost = "localhost"
    Write-Success "PostgreSQL Docker configurado com sucesso!"
}

Write-Host ""

# Configurar variáveis de ambiente
Write-Header "Configurando Variáveis de Ambiente"

# Backend .env
Write-Success "Criando backend/.env..."
Set-Location backend
$EnvContent = @"
# Configurações do Banco de Dados
DB_HOST=$DbHost
DB_PORT=5432
DB_USER=cred30user
DB_PASSWORD=cred30pass
DB_DATABASE=cred30

# Configurações da Aplicação
PORT=3001
NODE_ENV=development
JWT_SECRET=chave-super-secreta-desenvolvimento-$(Get-Date -Format 'yyyyMMddHHmmss')

# Configurações de Negócio
QUOTA_PRICE=50
LOAN_INTEREST_RATE=0.2
PENALTY_RATE=0.4
ADMIN_PIX_KEY=admin@pix.local
MIN_LOAN_AMOUNT=100
MAX_LOAN_AMOUNT=10000
"@
    
    $EnvContent | Out-File -FilePath ".env" -Encoding UTF8

# Frontend .env.local
Write-Success "Criando .env.local..."
Set-Location ..
$FrontendEnvContent = @"
VITE_API_URL=http://localhost:3001/api
VITE_ENV=development
"@
    
    $FrontendEnvContent | Out-File -FilePath ".env.local" -Encoding UTF8

Write-Host ""

# Inicializar banco de dados
Write-Header "Inicializando Banco de Dados"

if ($PostgresInstalled) {
    Write-Success "Inicializando schema do banco (PostgreSQL nativo)..."
    psql -h localhost -U cred30user -d cred30 -f scripts/init-db-fixed.sql 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Schema já existe ou houve erro na inicialização"
    }
} else {
    Write-Success "Inicializando schema do banco (PostgreSQL Docker)..."
    
    # Aguardar um pouco mais para Docker estar pronto
    Write-Success "Aguardando PostgreSQL Docker estar pronto..."
    Start-Sleep -Seconds 5
    
    # Copiar script para dentro do container
    docker cp scripts/init-db-fixed.sql cred30-postgres:/tmp/init-db-fixed.sql
    
    # Executar script
    docker exec cred30-postgres psql -U cred30user -d cred30 -f /tmp/init-db-fixed.sql 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Schema já existe ou houve erro na inicialização"
    }
}

Write-Host ""

# Verificar configuração
Write-Header "Verificando Configuração"

# Testar conexão com banco
if ($PostgresInstalled) {
    Write-Success "Testando conexão com PostgreSQL nativo..."
    try {
        $TestResult = psql -h localhost -U cred30user -d cred30 -c "SELECT 1;" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Conexão com PostgreSQL nativo OK!"
        } else {
            Write-Error "❌ Falha na conexão com PostgreSQL nativo"
            exit 1
        }
    } catch {
        Write-Error "❌ Erro ao testar conexão com PostgreSQL nativo: $($_.Exception.Message)"
        exit 1
    }
} else {
    Write-Success "Testando conexão com PostgreSQL Docker..."
    try {
        $TestResult = docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT 1;" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Conexão com PostgreSQL Docker OK!"
        } else {
            Write-Error "❌ Falha na conexão com PostgreSQL Docker"
            exit 1
        }
    } catch {
        Write-Error "❌ Erro ao testar conexão com PostgreSQL Docker: $($_.Exception.Message)"
        exit 1
    }
}

Write-Host ""

# Resumo da configuração
Write-Header "Resumo da Configuração"

Write-Success "✅ Setup concluído com sucesso!"
Write-Host ""
Write-Host "Configurações do Banco de Dados:" -ForegroundColor Cyan
Write-Host "  Tipo: $(if ($PostgresInstalled) { echo 'PostgreSQL Nativo' } else { echo 'PostgreSQL Docker' })"
Write-Host "  Host: $DbHost"
Write-Host "  Porta: 5432"
Write-Host "  Banco: cred30"
Write-Host "  Usuário: cred30user"
Write-Host ""
Write-Host "Variáveis de Ambiente:" -ForegroundColor Cyan
Write-Host "  Backend: backend\.env"
Write-Host "  Frontend: .env.local"
Write-Host ""
Write-Host "Próximos Passos:" -ForegroundColor Cyan
Write-Host "  1. Iniciar o backend: cd backend && npm run dev" -ForegroundColor Yellow
Write-Host "  2. Iniciar o frontend (outro terminal): npm run dev" -ForegroundColor Yellow
Write-Host "  3. Acessar a aplicação: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  4. API endpoints: http://localhost:3001/api" -ForegroundColor Yellow
Write-Host ""
Write-Host "Credenciais Iniciais:" -ForegroundColor Cyan
Write-Host "  Primeiro usuário: Registre via interface"
Write-Host "  Email: admin@cred30.com"
Write-Host "  Senha: admin123"
Write-Host ""
Write-Host "Comandos Úteis:" -ForegroundColor Cyan
Write-Host "  Verificar status PostgreSQL: docker ps | grep postgres" -ForegroundColor White
Write-Host "  Logs do PostgreSQL: docker logs cred30-postgres" -ForegroundColor White
Write-Host "  Conectar ao banco: psql -h localhost -U cred30user -d cred30" -ForegroundColor White
Write-Host "  Resetar banco: cd backend && node scripts/reset-db-fixed.js" -ForegroundColor White
Write-Host ""
Write-Success "Setup completo! A aplicação está pronta para desenvolvimento local."

# Pausar para usuário ler
Write-Host ""
Write-Host "Pressione Enter para continuar..." -ForegroundColor Yellow
Read-Host