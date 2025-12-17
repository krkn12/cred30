# GUIA COMPLETO DE IMPLEMENTAÇÃO ZERO-COST - CRED30

## SUMÁRIO EXECUTIVO

Este guia passo a passo permite configurar e executar a plataforma financeira CRED30 no seu laptop sem custos de infraestrutura, utilizando apenas ferramentas gratuitas e serviços locais. Focado em funcionalidades essenciais para validação do conceito com um grupo pequeno de usuários teste.

---

## 1. PRÉ-REQUISITOS ZERO-COST

### 1.1 Software Necessário (Todos Gratuitos)

**Obrigatórios:**

- **Node.js** (v18+): https://nodejs.org (gratuito)
- **Git**: https://git-scm.com (gratuito)
- **VS Code**: https://code.visualstudio.com (gratuito)
- **Navegador Moderno**: Chrome/Firefox (gratuito)

**Opcionais Recomendados:**

- **Docker Desktop**: https://docker.com (gratuito para uso pessoal)
- **PostgreSQL**: Via Docker ou instalação local (gratuito)
- **ngrok**: https://ngrok.com (plano gratuito com limitações)

### 1.2 Hardware Mínimo

- **RAM**: 4GB (8GB recomendado)
- **Armazenamento**: 10GB livres
- **Processador**: Qualquer CPU moderna

---

## 2. CONFIGURAÇÃO DO AMBIENTE DE DESENVOLVIMENTO

### 2.1 Instalação do Node.js e Gerenciador de Pacotes

```bash
# Instalar Node.js (inclui npm)
# Baixe em https://nodejs.org e siga o instalador

# Verificar instalação
node --version
npm --version

# Instalar Bun (alternativa mais rápida ao npm)
npm install -g bun
bun --version
```

### 2.2 Clonar e Preparar o Projeto

```bash
# Clonar o repositório
git clone <URL-DO-REPOSITORIO>
cd cred30

# Instalar dependências do frontend
npm install

# Instalar dependências do backend
cd backend
npm install
cd ..
```

### 2.3 Configurar Banco de Dados Local Gratuito

**Opção 1: PostgreSQL via Docker (Recomendado)**

```bash
# Criar arquivo docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: cred30-db
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

# Iniciar PostgreSQL
docker-compose up -d postgres

# Verificar se está rodando
docker ps
```

**Opção 2: PostgreSQL Nativo**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createuser --interactive
sudo -u postgres createdb cred30

# macOS (com Homebrew)
brew install postgresql
brew services start postgresql
createuser -s cred30user
createdb -O cred30user cred30
```

### 2.4 Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env no backend
cd backend
cat > .env << 'EOF'
# Configurações do Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=cred30user
DB_PASSWORD=cred30pass
DB_DATABASE=cred30

# Configurações da Aplicação
PORT=3001
JWT_SECRET=chave-super-secreta-dev-123456789
NODE_ENV=development

# Configurações de Negócio
QUOTA_PRICE=50
LOAN_INTEREST_RATE=0.2
PENALTY_RATE=0.4
ADMIN_PIX_KEY=seu-pix-aqui
EOF

# Criar arquivo .env no frontend
cd ..
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:3001/api
VITE_ENV=development
EOF
```

---

## 3. IMPLEMENTAÇÃO DE FUNCIONALIDADES ESSENCIAIS MVP

### 3.1 Funcionalidades Mínimas para Validação

**Essencial (Mínimo Viável):**

1. ✅ Registro e login de usuários
2. ✅ Compra de cotas (via saldo simulado)
3. ✅ Visualização de portfólio
4. ✅ Solicitação de empréstimos
5. ✅ Painel administrativo básico

**Opcional (Para Validação Completa):** 6. 💳 Sistema de saques (simulado) 7. 📊 Relatórios básicos 8. 👥 Sistema de indicações

### 3.2 Otimizações para Deploy Local

**Reduzir Dependências:**

```bash
# Remover dependências não essenciais do package.json
cd backend
npm uninstall @types/bcrypt @types/jsonwebtoken @types/cors @types/pg

# Manter apenas essenciais
npm install hono pg jsonwebtoken zod cors bcrypt
```

**Configurar Build Leve:**

```javascript
// backend/vite.config.js (criar se não existir)
export default {
  build: {
    target: "node18",
    minify: false, // Desativar para desenvolvimento
    sourcemap: true,
  },
  server: {
    port: 3001,
    host: true, // Aceitar conexões externas (ngrok)
  },
};
```

### 3.3 Scripts de Desenvolvimento

```json
// Adicionar ao package.json do backend
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "dev-simple": "node --watch src/index.js",
    "build": "bun build src/index.ts --target=node --outdir=dist",
    "start": "node dist/index.js",
    "db-reset": "node scripts/reset-db.js",
    "seed": "node scripts/seed-data.js"
  }
}
```

---

## 4. ESTRATÉGIA DE DEPLOY ZERO-COST

### 4.1 Exposição Local com ngrok (Grátis)

#### 🚀 Início Rápido com ngrok

**Opção 1: Script Automático (Recomendado)**

**Windows:**

```bash
start-ngrok.bat
```

**Linux/Mac:**

```bash
chmod +x start-ngrok.sh
./start-ngrok.sh
```

**Opção 2: Configuração Manual**

**1. Instalar ngrok:**

```bash
npm install -g ngrok

# Autenticar (se necessário)
ngrok config add-authtoken SEU_TOKEN
```

**2. Iniciar com Docker:**

```bash
docker-compose -f docker-compose.ngrok.yml up -d
```

**3. Iniciar ngrok manualmente:**

```bash
# Frontend (porta 5173)
ngrok http 5173

# Backend (porta 3001) - em outro terminal
ngrok http 3001
```

#### 📱 URLs e Acesso

Após iniciar, você receberá URLs como:

```
Frontend: https://abcd-1234-5678.ngrok-free.app
Backend:  https://efgh-9012-3456.ngrok-free.app
```

**Acesso:**

- **Dashboard Admin**: `[URL Frontend]/admin`
- **Dashboard Cliente**: `[URL Frontend]`

**Credenciais de Teste:**

```
Admin: admin@cred30.com / admin123
Cliente: joao@cred30.com / cliente123
```

### 4.2 Configurar Frontend para Acessar Backend Remoto

```javascript
// Atualizar .env.local
VITE_API_URL=https://SEU_NGROK_BACKEND.ngrok-free.app/api
```

### 4.3 Deploy Frontend Local com HTTPS

```bash
# Iniciar frontend
npm run dev

# Acessar via: https://localhost:5173
# Vite gera certificado SSL automaticamente para desenvolvimento
```

### 4.4 Alternativa: GitHub Pages (Grátis)

```bash
# Build do frontend para produção
npm run build

# Deploy para GitHub Pages
npm install -g gh-pages
gh-pages -d dist

# Configurar no repositório GitHub:
# Settings > Pages > Source: Deploy from a branch
# Branch: gh-pages
```

### 4.5 Testar Integração com ngrok

**Teste Automático:**

```bash
node test-ngrok-integration.js

# Ou com URLs específicas:
FRONTEND_URL=https://abc-123.ngrok-free.app BACKEND_URL=https://def-456.ngrok-free.app node test-ngrok-integration.js
```

**Teste Manual:**

```bash
# Testar health check
curl https://SEU_NGROK.ngrok-free.app/api/health

# Testar login
curl -X POST https://SEU_NGROK.ngrok-free.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cred30.com","password":"admin123"}'
```

### 4.6 Configurações Avançadas do ngrok

**Arquivo ngrok.yml (opcional):**

```yaml
tunnels:
  frontend:
    proto: http
    addr: 5173
    bind_tls: true
    subdomain: cred30-frontend
  backend:
    proto: http
    addr: 3001
    bind_tls: true
    subdomain: cred30-backend
```

**Usar configuração personalizada:**

```bash
ngrok start --all --config ngrok.yml
```

### 4.7 Monitoramento ngrok

**Ver status:**

```bash
# Ver túneis ativos
curl http://localhost:4040/api/tunnels

# Ver logs em tempo real
ngrok http 5173 --log=stdout
```

**Reiniciar automaticamente:**

```bash
# Script para reiniciar se cair
while true; do
  ngrok http 5173
  sleep 5
done
```

---

## 5. SCRIPTS DE AUTOMAÇÃO

### 5.1 Scripts de ngrok

**Script para Windows (start-ngrok.bat):**

```batch
@echo off
echo 🚀 Iniciando CRED30 com ngrok...

# Verificar se ngrok está instalado
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ngrok não encontrado. Por favor, instale o ngrok.
    pause
    exit /b 1
)

# Parar containers existentes
echo 🛑 Parando containers existentes...
docker-compose -f docker-compose.ngrok.yml down --remove-orphans

# Iniciar containers
echo 🐳 Iniciando containers...
docker-compose -f docker-compose.ngrok.yml up -d

# Aguardar serviços
echo ⏳ Aguardando serviços iniciarem...
timeout /t 30 /nobreak >nul

# Iniciar ngrok
echo 🌐 Iniciando ngrok...
start "Ngrok Frontend" cmd /k "ngrok http 5173"
start "Ngrok Backend" cmd /k "ngrok http 3001"

echo ✅ CRED30 está online com ngrok!
echo 📱 Acesse: http://localhost:5173 ou via URL ngrok
pause
```

**Script para Linux/Mac (start-ngrok.sh):**

```bash
#!/bin/bash
echo "🚀 Iniciando CRED30 com ngrok..."

# Verificar se ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não encontrado. Por favor, instale o ngrok."
    exit 1
fi

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker-compose -f docker-compose.ngrok.yml down --remove-orphans

# Iniciar containers
echo "🐳 Iniciando containers..."
docker-compose -f docker-compose.ngrok.yml up -d

# Aguardar serviços
echo "⏳ Aguardando serviços iniciarem..."
sleep 30

# Iniciar ngrok
echo "🌐 Iniciando ngrok..."
ngrok http 5173 &
ngrok http 3001 &

echo "✅ CRED30 está online com ngrok!"
echo "📱 Acesse: http://localhost:5173 ou via URL ngrok"
```

### 5.2 Script de Teste de Integração (test-ngrok-integration.js)

Este script testa automaticamente todos os endpoints através das URLs do ngrok:

```bash
# Uso básico
node test-ngrok-integration.js

# Com URLs específicas
FRONTEND_URL=https://abc-123.ngrok-free.app BACKEND_URL=https://def-456.ngrok-free.app node test-ngrok-integration.js
```

**O que o script testa:**

- Conectividade básica
- Autenticação (admin e cliente)
- Endpoints principais da API
- Funcionalidades específicas (empréstimos, saques)
- Integração frontend-backend

---

## 6. GUIA PASSO A PASSO DE EXECUÇÃO

### 5.1 Primeira Execução

```bash
# 1. Iniciar banco de dados
docker-compose up -d postgres

# 2. Verificar conexão com banco
docker exec -it cred30-db psql -U cred30user -d cred30 -c "SELECT 1;"

# 3. Iniciar backend
cd backend
npm run dev

# 4. Em outro terminal, iniciar frontend
npm run dev

# 5. Acessar aplicação
# Frontend: http://localhost:5173
# Backend: http://localhost:3001/api
```

### 5.2 Testes Funcionais Essenciais

**Teste 1: Registro de Usuário**

```bash
# Via interface ou API:
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Usuário Teste",
    "email": "teste@example.com",
    "password": "123456",
    "secretPhrase": "teste123",
    "pixKey": "teste@pix.com"
  }'
```

**Teste 2: Login**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "password": "123456",
    "secretPhrase": "teste123"
  }'
```

**Teste 3: Compra de Cota**

```bash
# Usar token do login anterior
curl -X POST http://localhost:3001/api/quotas/buy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "quantity": 1,
    "useBalance": true
  }'
```

### 5.3 Validação do Fluxo Completo

1. **Cadastro**: Registrar 2-3 usuários teste
2. **Investimento**: Comprar cotas simuladas
3. **Empréstimo**: Solicitar empréstimo pequeno
4. **Admin**: Aprovar operações no painel
5. **Relatórios**: Verificar funcionamento básico

---

## 6. SCRIPTS DE AUTOMAÇÃO

### 6.1 Script de Reset de Banco (scripts/reset-db.js)

```javascript
// backend/scripts/reset-db.js
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "cred30user",
  password: process.env.DB_PASSWORD || "cred30pass",
  database: process.env.DB_DATABASE || "cred30",
});

async function resetDatabase() {
  console.log("Resetando banco de dados...");

  await pool.query("DELETE FROM transactions");
  await pool.query("DELETE FROM loans");
  await pool.query("DELETE FROM quotas");
  await pool.query("DELETE FROM users");

  console.log("Banco resetado com sucesso!");
  await pool.end();
}

resetDatabase().catch(console.error);
```

### 6.2 Script de Dados Iniciais (scripts/seed-data.js)

```javascript
// backend/scripts/seed-data.js
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "cred30user",
  password: process.env.DB_PASSWORD || "cred30pass",
  database: process.env.DB_DATABASE || "cred30",
});

async function seedData() {
  console.log("Inserindo dados iniciais...");

  // Criar usuário admin
  const hashedPassword = await bcrypt.hash("admin123", 10);

  await pool.query(
    `
    INSERT INTO users (name, email, password, secret_phrase, pix_key, balance, referral_code, is_admin)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `,
    [
      "Administrador",
      "admin@cred30.local",
      hashedPassword,
      "admin",
      "admin@pix.local",
      10000, // Saldo inicial para testes
      "ADMIN001",
      true,
    ]
  );

  console.log("Dados iniciais inseridos com sucesso!");
  await pool.end();
}

seedData().catch(console.error);
```

---

## 7. MONITORAMENTO E DEBUG LOCAL

### 7.1 Logs Estruturados

```javascript
// backend/src/utils/logger.js
const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data,
  };

  console.log(`[${level}] ${message}`, data);

  // Salvar em arquivo
  fs.appendFileSync(
    path.join(logDir, "app.log"),
    JSON.stringify(logEntry) + "\n"
  );
}

module.exports = {
  info: (message, data) => log("INFO", message, data),
  error: (message, data) => log("ERROR", message, data),
  warn: (message, data) => log("WARN", message, data),
};
```

### 7.2 Health Check Simplificado

```javascript
// backend/src/routes/health.js
const { Pool } = require("pg");

const pool = new Pool({
  // suas configurações
});

async function healthCheck() {
  try {
    const result = await pool.query("SELECT NOW()");
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      db_time: result.rows[0].now,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message,
    };
  }
}

module.exports = { healthCheck };
```

---

## 8. ESTRATÉGIA DE TESTES COM USUÁRIOS

### 8.1 Plano de Testes Controlados

**Fase 1: Testes Internos (Semana 1)**

- 3-5 usuários internos
- Testar fluxo completo
- Identificar bugs críticos

**Fase 2: Amigos e Família (Semana 2-3)**

- 10-15 usuários confiáveis
- Testar com dados reais (valores baixos)
- Coletar feedback

**Fase 3: Beta Fechado (Semana 4-6)**

- 50-100 usuários selecionados
- Monitorar performance
- Ajustar fluxos

### 8.2 Checklist de Validação

**Funcional:**

- [ ] Registro funciona corretamente
- [ ] Login é estável
- [ ] Compra de cotas funciona
- [ ] Empréstimos são processados
- [ ] Painel admin funciona

**Técnico:**

- [ ] Sem erros no console
- [ ] Performance aceitável
- [ ] Dados persistem corretamente
- [ ] Backup funciona

**Negócio:**

- [ ] Usuários entendem o fluxo
- [ ] Proposta de valor é clara
- [ ] Interface é intuitiva
- [ ] Feedback é positivo

---

## 9. SOLUÇÕES PARA PROBLEMAS COMUNS

### 9.1 Problemas de Porta

```bash
# Verificar portas em uso
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
netstat -tulpn | grep :5432

# Matar processos se necessário
sudo kill -9 <PID>
```

### 9.2 Problemas de Banco de Dados

```bash
# Reiniciar PostgreSQL
docker-compose restart postgres

# Verificar logs
docker logs cred30-db

# Conectar manualmente
docker exec -it cred30-db psql -U cred30user -d cred30
```

### 9.3 Problemas de CORS

```javascript
// backend/src/index.ts - Verificar configuração CORS
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "https://abc123.ngrok-free.app"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);
```

### 9.4 Problemas de ngrok

**ngrok não inicia:**

```bash
# Verificar autenticação
ngrok config check

# Verificar se está instalado
which ngrok
ngrok version

# Reinstalar se necessário
npm uninstall -g ngrok
npm install -g ngrok
```

**URL ngrok não funciona:**

```bash
# Verificar se o serviço local está rodando
curl http://localhost:3001/api/health
curl http://localhost:5173

# Verificar logs do ngrok
ngrok http 3001 --log=stdout

# Tentar porta diferente
ngrok http 3002
```

**ngrok desconecta frequentemente:**

```bash
# Usar script de reinício automático
while true; do
  ngrok http 3001
  sleep 5
done

# Ou verificar plano gratuito (limites de uso)
ngrok config check
```

**Problemas de CORS com ngrok:**

```javascript
// backend/src/index.ts - Adicionar URL ngrok ao CORS
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173",
      "https://localhost:5173",
      // Adicione suas URLs ngrok aqui
      "https://abc123.ngrok-free.app",
      "https://def456.ngrok-free.app",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
```

### 9.5 Problemas de Docker com ngrok

**Containers não iniciam:**

```bash
# Verificar Docker Desktop
docker info

# Limpar containers antigos
docker system prune -f

# Recriar containers
docker-compose -f docker-compose.ngrok.yml down
docker-compose -f docker-compose.ngrok.yml up -d --force-recreate
```

**Problemas de rede:**

```bash
# Verificar rede Docker
docker network ls
docker network inspect cred30-network-ngrok

# Recriar rede
docker network rm cred30-network-ngrok
docker-compose -f docker-compose.ngrok.yml up -d
```

### 9.6 Limitações do Plano Gratuito ngrok

**Limitações conhecidas:**

- URLs aleatórias a cada sessão
- 1 hora de tempo máximo de sessão
- 40 conexões simultâneas
- 1GB de tráfego por mês

**Soluções:**

```bash
# Para sessões mais longas, usar script de reinício
while true; do
  ngrok http 3001 --authtoken SEU_TOKEN
  sleep 300  # Reinicia a cada 5 minutos
done

# Para URLs fixas, considerar plano pago
# Ou usar alternativas como cloudflared
```

---

## 10. PRÓXIMOS PASSOS (APÓS VALIDAÇÃO)

### 10.1 Quando Migrar para Servidor Pago

**Indicadores:**

- 100+ usuários ativos
- R$ 10.000+ em transações
- Sistema estável por 30+ dias
- Feedback positivo consistente

**Opções de Hospedagem (Low-Cost):**

- **DigitalOcean**: $5/mês
- **Vultr**: $3.50/mês
- **Linode**: $5/mês
- **Railway**: $5/mês (com PostgreSQL incluído)

### 10.2 Roadmap de Crescimento

**Mês 1-3: Validação**

- Deploy local com ngrok
- Testes com usuários reais
- Correções de bugs

**Mês 4-6: Escala Inicial**

- Deploy em servidor low-cost
- 100-500 usuários
- Automação de processos

**Mês 7-12: Expansão**

- Múltiplos servidores
- 1000+ usuários
- Novas funcionalidades

---

## 11. RECURSOS E FERRAMENTAS GRATUITAS

### 11.1 Ferramentas de Desenvolvimento

- **VS Code**: Editor de código
- **Git**: Controle de versão
- **GitHub**: Repositório de código
- **Postman**: Testes de API
- **Docker Desktop**: Containers

### 11.2 Serviços Gratuitos

- **ngrok**: Túnel HTTPS (grátis com limitações)
- **GitHub Pages**: Hospedagem frontend
- **Railway**: Deploy backend (plano gratuito)
- **MongoDB Atlas**: Banco alternativo (512MB grátis)
- **Firebase Hosting**: Alternativa frontend

### 11.3 Monitoramento e Analytics

- **Google Analytics**: Análise de usuários
- **Sentry**: Monitoramento de erros (plano gratuito)
- **UptimeRobot**: Monitoramento de disponibilidade
- **Lighthouse**: Performance e SEO

---

## CONCLUSÃO

Este guia permite implementar e testar a plataforma CRED30 completamente sem custos de infraestrutura, utilizando apenas ferramentas gratuitas e seu laptop como ambiente de desenvolvimento. A abordagem foca em funcionalidades essenciais para validação do conceito antes de investir em infraestrutura paga.

**Próximos Passos Imediatos:**

1. Seguir este guia passo a passo
2. Implementar as funcionalidades essenciais
3. Realizar testes com um grupo pequeno
4. Coletar feedback e iterar
5. Planejar migração para infraestrutura paga quando validar o modelo

Com esta abordagem zero-cost, você pode validar completamente o conceito de negócio antes de qualquer investimento financeiro significativo.
