@echo off
chcp 65001 >nul
echo CORRIGINDO CONFIGURACAO DOS CONTAINERS DOCKER...
echo ================================================

echo Parando containers atuais...
docker-compose -f docker/docker-compose.single-ngrok.yml down

echo Criando Dockerfile.dev para o backend...
(
echo FROM node:18-alpine
echo.
echo WORKDIR /app
echo.
echo # Instalar dependencias
echo COPY packages/backend/package*.json ./
echo RUN npm ci
echo.
echo # Copiar codigo fonte
echo COPY packages/backend ./
echo.
echo # Expor porta
echo EXPOSE 3001
echo.
echo # Comando para desenvolvimento
echo CMD ["npm", "run", "dev"]
) > packages/backend/Dockerfile.dev

echo Corrigindo configuracao do docker-compose...
(
echo version: "3.8"
echo.
echo services:
echo   # PostgreSQL Database
echo   postgres:
echo     image: postgres:15-alpine
echo     container_name: cred30-postgres-single
echo     environment:
echo       POSTGRES_DB: cred30
echo       POSTGRES_USER: postgres
echo       POSTGRES_PASSWORD: postgres
echo     ports:
echo       - "5432:5432"
echo     volumes:
echo       - postgres_data:/var/lib/postgresql/data
echo       - ./scripts/database/init-db-fixed.sql:/docker-entrypoint-initdb.d/init-db.sql
echo     restart: unless-stopped
echo     healthcheck:
echo       test: ["CMD-SHELL", "pg_isready -U postgres -d cred30"]
echo       interval: 10s
echo       timeout: 5s
echo       retries: 5
echo.
echo   # Backend API
echo   backend:
echo     build:
echo       context: ./packages/backend
echo       dockerfile: Dockerfile.dev
echo     container_name: cred30-backend-single
echo     environment:
echo       NODE_ENV: development
echo       DB_HOST: postgres
echo       DB_PORT: 5432
echo       DB_USER: postgres
echo       DB_PASSWORD: postgres
echo       DB_DATABASE: cred30
echo       PORT: 3001
echo       JWT_SECRET: ngrok-dev-secret-key-123456789
echo       QUOTA_PRICE: 50
echo       LOAN_INTEREST_RATE: 0.2
echo       PENALTY_RATE: 0.4
echo       ADMIN_PIX_KEY: admin@pix.local
echo     ports:
echo       - "3001:3001"
echo     depends_on:
echo       postgres:
echo         condition: service_healthy
echo     restart: unless-stopped
echo     volumes:
echo       - ./packages/backend/src:/app/src
echo       - /app/node_modules
echo     command: npm run dev
echo.
echo   # Frontend
echo   frontend:
echo     build:
echo       context: .
echo       dockerfile: docker/Dockerfile.dev
echo     container_name: cred30-frontend-single
echo     environment:
echo       VITE_API_URL: http://localhost:3001
echo       VITE_ENV: development
echo     ports:
echo       - "5173:5173"
echo     depends_on:
echo       - backend
echo     restart: unless-stopped
echo     volumes:
echo       - ./packages/frontend:/app/packages/frontend
echo       - ./package.json:/app/package.json
echo       - /app/node_modules
echo     command: sh -c "cd packages/frontend && npm run dev"
echo.
echo   # Redis para cache
echo   redis:
echo     image: redis:7-alpine
echo     container_name: cred30-redis-single
echo     ports:
echo       - "6379:6379"
echo     volumes:
echo       - redis_data:/data
echo     restart: unless-stopped
echo     command: redis-server --appendonly yes
echo.
echo volumes:
echo   postgres_data:
echo     driver: local
echo   redis_data:
echo     driver: local
echo.
echo networks:
echo   default:
echo     name: cred30-network-single
) > docker/docker-compose.single-ngrok.yml

echo Reconstruindo e iniciando containers...
docker-compose -f docker/docker-compose.single-ngrok.yml up --build -d

echo Aguardando containers iniciarem...
timeout /t 15 /nobreak >nul

echo Verificando status dos containers...
docker-compose -f docker/docker-compose.single-ngrok.yml ps

echo.
echo Containers corrigidos e iniciados!
echo.
echo Aplicacoes disponiveis em:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001
echo.
pause