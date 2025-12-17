#!/bin/bash

# Script Completo de Setup do CRED30 para Desenvolvimento Local
# Este script configura tudo automaticamente: banco de dados, variáveis de ambiente e inicialização

echo "🚀 Iniciando Setup Completo do CRED30 para Desenvolvimento Local"
echo "=================================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ====${NC}"
}

# Verificar pré-requisitos
print_header "Verificando Pré-requisitos"

# Verificar Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js encontrado: $NODE_VERSION"
else
    print_error "Node.js não encontrado. Por favor, instale de https://nodejs.org"
    exit 1
fi

# Verificar npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm encontrado: $NPM_VERSION"
else
    print_error "npm não encontrado. Por favor, instale Node.js (inclui npm)"
    exit 1
fi

# Verificar PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    print_status "PostgreSQL encontrado: $PSQL_VERSION"
    POSTGRES_INSTALLED=true
else
    print_warning "PostgreSQL não encontrado nativo. Será usado Docker"
    POSTGRES_INSTALLED=false
fi

# Verificar Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    print_status "Git encontrado: $GIT_VERSION"
else
    print_error "Git não encontrado. Por favor, instale de https://git-scm.com"
    exit 1
fi

echo ""

# Instalar dependências
print_header "Instalando Dependências"

print_status "Instalando dependências do projeto principal..."
npm install

print_status "Instalando dependências do backend..."
cd backend
npm install
cd ..

echo ""

# Configurar banco de dados
print_header "Configurando Banco de Dados"

if [ "$POSTGRES_INSTALLED" = true ]; then
    print_status "Configurando PostgreSQL nativo..."
    
    # Criar banco de dados
    print_status "Criando banco de dados 'cred30'..."
    createdb cred30 2>/dev/null || print_warning "Banco 'cred30' já existe"
    
    # Criar usuário
    print_status "Criando usuário 'cred30user'..."
    createuser cred30user 2>/dev/null || print_warning "Usuário 'cred30user' já existe"
    
    # Configurar permissões
    print_status "Configurando permissões..."
    psql -d postgres -c "ALTER USER cred30user WITH PASSWORD 'cred30pass';" 2>/dev/null
    psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE cred30 TO cred30user;" 2>/dev/null
    
    DB_HOST="localhost"
    print_status "PostgreSQL nativo configurado com sucesso!"
else
    print_status "Configurando PostgreSQL com Docker..."
    
    # Criar docker-compose.yml
    print_status "Criando docker-compose.yml..."
    cat > docker-compose.yml << 'EOF'
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
EOF
    
    # Iniciar Docker
    print_status "Iniciando PostgreSQL com Docker..."
    docker-compose up -d
    
    # Aguardar PostgreSQL iniciar
    print_status "Aguardando PostgreSQL inicializar..."
    sleep 10
    
    DB_HOST="localhost"
    print_status "PostgreSQL Docker configurado com sucesso!"
fi

echo ""

# Configurar variáveis de ambiente
print_header "Configurando Variáveis de Ambiente"

# Backend .env
print_status "Criando backend/.env..."
cd backend
cat > .env << 'EOF'
# Configurações do Banco de Dados
DB_HOST=$DB_HOST
DB_PORT=5432
DB_USER=cred30user
DB_PASSWORD=cred30pass
DB_DATABASE=cred30

# Configurações da Aplicação
PORT=3001
NODE_ENV=development
JWT_SECRET=chave-super-secreta-desenvolvimento-$(date +%s)

# Configurações de Negócio
QUOTA_PRICE=50
LOAN_INTEREST_RATE=0.2
PENALTY_RATE=0.4
ADMIN_PIX_KEY=admin@pix.local
MIN_LOAN_AMOUNT=100
MAX_LOAN_AMOUNT=10000
EOF

# Frontend .env.local
print_status "Criando .env.local..."
cd ..
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:3001/api
VITE_ENV=development
EOF

echo ""

# Inicializar banco de dados
print_header "Inicializando Banco de Dados"

if [ "$POSTGRES_INSTALLED" = true ]; then
    print_status "Inicializando schema do banco (PostgreSQL nativo)..."
    psql -h localhost -U cred30user -d cred30 -f scripts/init-db-fixed.sql 2>/dev/null || print_warning "Schema já existe"
else
    print_status "Inicializando schema do banco (PostgreSQL Docker)..."
    # Aguardar um pouco mais para Docker estar pronto
    sleep 5
    docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT 1;" 2>/dev/null || print_warning "Aguardando PostgreSQL..."
    sleep 5
    
    # Copiar script para dentro do container
    docker cp scripts/init-db-fixed.sql cred30-postgres:/tmp/init-db-fixed.sql
    docker exec cred30-postgres psql -U cred30user -d cred30 -f /tmp/init-db-fixed.sql 2>/dev/null || print_warning "Schema já existe"
fi

echo ""

# Verificar configuração
print_header "Verificando Configuração"

# Testar conexão com banco
if [ "$POSTGRES_INSTALLED" = true ]; then
    print_status "Testando conexão com PostgreSQL nativo..."
    if psql -h localhost -U cred30user -d cred30 -c "SELECT 1;" &> /dev/null; then
        print_status "✅ Conexão com PostgreSQL nativo OK!"
    else
        print_error "❌ Falha na conexão com PostgreSQL nativo"
        exit 1
    fi
else
    print_status "Testando conexão com PostgreSQL Docker..."
    if docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT 1;" &> /dev/null; then
        print_status "✅ Conexão com PostgreSQL Docker OK!"
    else
        print_error "❌ Falha na conexão com PostgreSQL Docker"
        exit 1
    fi
fi

echo ""

# Resumo da configuração
print_header "Resumo da Configuração"

echo -e "${GREEN}✅ Setup concluído com sucesso!${NC}"
echo ""
echo -e "${BLUE}Configurações do Banco de Dados:${NC}"
echo -e "  Tipo: $([ "$POSTGRES_INSTALLED" = true ] && echo "PostgreSQL Nativo" || echo "PostgreSQL Docker")"
echo -e "  Host: $DB_HOST"
echo -e "  Porta: 5432"
echo -e "  Banco: cred30"
echo -e "  Usuário: cred30user"
echo ""
echo -e "${BLUE}Variáveis de Ambiente:${NC}"
echo -e "  Backend: backend/.env"
echo -e "  Frontend: .env.local"
echo ""
echo -e "${BLUE}Próximos Passos:${NC}"
echo -e "  1. Iniciar o backend: ${YELLOW}cd backend && npm run dev${NC}"
echo -e "  2. Iniciar o frontend (outro terminal): ${YELLOW}npm run dev${NC}"
echo -e "  3. Acessar a aplicação: ${YELLOW}http://localhost:5173${NC}"
echo -e "  4. API endpoints: ${YELLOW}http://localhost:3001/api${NC}"
echo ""
echo -e "${BLUE}Credenciais Iniciais:${NC}"
echo -e "  Primeiro usuário: Registre via interface"
echo -e "  Email: admin@cred30.com"
echo -e "  Senha: admin123"
echo ""

print_status "Setup completo! A aplicação está pronta para desenvolvimento local."

echo ""
echo -e "${YELLOW}=== Comandos Úteis ===${NC}"
echo -e "${BLUE}Verificar status do PostgreSQL:${NC} docker ps | grep postgres"
echo -e "${BLUE}Logs do PostgreSQL:${NC} docker logs cred30-postgres"
echo -e "${BLUE}Conectar ao banco:${NC} psql -h localhost -U cred30user -d cred30"
echo -e "${BLUE}Resetar banco:${NC} cd backend && node scripts/reset-db-fixed.js"
echo -e "${BLUE}Parar PostgreSQL Docker:${NC} docker-compose down"
echo ""