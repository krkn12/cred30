# Script para corrigir problemas dos containers Docker
Write-Host "🔧 CORRIGINDO CONFIGURAÇÃO DOS CONTAINERS DOCKER..." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow

# Parar containers atuais
Write-Host "🛑 Parando containers atuais..." -ForegroundColor Cyan
docker-compose -f docker/docker-compose.single-ngrok.yml down

# Corrigir problemas de configuração
Write-Host "📝 Corrigindo configuração..." -ForegroundColor Cyan

# Criar Dockerfile.dev para o backend
$backendDockerfile = @"
FROM node:18-alpine

WORKDIR /app

# Instalar dependências
COPY packages/backend/package*.json ./
RUN npm ci

# Copiar código fonte
COPY packages/backend ./

# Expor porta
EXPOSE 3001

# Comando para desenvolvimento
CMD ["npm", "run", "dev"]
"@

Set-Content -Path "packages/backend/Dockerfile.dev" -Value $backendDockerfile -Encoding UTF8

# Atualizar docker-compose.single-ngrok.yml
$dockerCompose = @"
version: "3.8"

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: cred30-postgres-single
    environment:
      POSTGRES_DB: cred30
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/database/init-db-fixed.sql:/docker-entrypoint-initdb.d/init-db.sql
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d cred30"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile.dev
    container_name: cred30-backend-single
    environment:
      NODE_ENV: development
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_DATABASE: cred30
      PORT: 3001
      JWT_SECRET: ngrok-dev-secret-key-123456789
      QUOTA_PRICE: 50
      LOAN_INTEREST_RATE: 0.2
      PENALTY_RATE: 0.4
      ADMIN_PIX_KEY: admin@pix.local
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - ./packages/backend/src:/app/src
      - /app/node_modules
    command: npm run dev

  # Frontend
  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev
    container_name: cred30-frontend-single
    environment:
      VITE_API_URL: http://localhost:3001
      VITE_ENV: development
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
    volumes:
      - ./packages/frontend:/app/packages/frontend
      - ./package.json:/app/package.json
      - /app/node_modules
    command: sh -c "cd packages/frontend && npm run dev"

  # Redis para cache
  redis:
    image: redis:7-alpine
    container_name: cred30-redis-single
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  default:
    name: cred30-network-single
"@

Set-Content -Path "docker/docker-compose.single-ngrok.yml" -Value $dockerCompose -Encoding UTF8

# Reconstruir e iniciar containers
Write-Host "🔄 Reconstruindo e iniciando containers..." -ForegroundColor Cyan
docker-compose -f docker/docker-compose.single-ngrok.yml up --build -d

# Aguardar containers iniciarem
Write-Host "⏳ Aguardando containers iniciarem..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Verificar status
Write-Host "📊 Verificando status dos containers..." -ForegroundColor Cyan
docker-compose -f docker/docker-compose.single-ngrok.yml ps

Write-Host "✅ Containers corrigidos e iniciados!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Aplicações disponíveis em:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor White
Write-Host ""