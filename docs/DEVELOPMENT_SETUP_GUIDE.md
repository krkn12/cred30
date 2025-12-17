# Guia Completo: Setup de Desenvolvimento Local CRED30

Este guia detalha passo a passo como configurar e executar a aplicação CRED30 em ambiente de desenvolvimento local com PostgreSQL real, sem dados de teste/mock.

## 📋 Sumário

1. [Pré-requisitos](#pré-requisitos)
2. [Instalação e Configuração](#instalação-e-configuração)
3. [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
4. [Variáveis de Ambiente](#variáveis-de-ambiente)
5. [Inicialização do Banco](#inicialização-do-banco)
6. [Execução da Aplicação](#execução-da-aplicação)
7. [Verificação de Funcionamento](#verificação-de-funcionamento)
8. [Fluxo de Uso](#fluxo-de-uso)
9. [Solução de Problemas](#solução-de-problemas)

## 🛠️ Pré-requisitos

### Software Necessário

#### 1. Node.js (v18+)

```bash
# Verificar instalação
node --version
npm --version

# Se não tiver, baixe de https://nodejs.org
```

#### 2. PostgreSQL

```bash
# Windows: Baixe de https://www.postgresql.org/download/windows/
# macOS: brew install postgresql
# Linux: sudo apt install postgresql postgresql-contrib

# Verificar instalação
psql --version
```

#### 3. Git

```bash
# Verificar instalação
git --version

# Se não tiver, baixe de https://git-scm.com
```

#### 4. VS Code (Recomendado)

```bash
# Baixe de https://code.visualstudio.com
# Extensões úteis:
# - ES7+ React/Redux/React-Native snippets
# - Prettier
# - ESLint
# - PostgreSQL
```

#### 5. Docker Desktop (Opcional, mas recomendado)

```bash
# Baixe de https://www.docker.com/products/docker-desktop
# Útil para gerenciar PostgreSQL se preferir
```

## 📦 Instalação e Configuração

### 1. Clonar o Projeto

```bash
# Se já não tiver o repositório
git clone <URL-DO-REPOSITORIO>
cd cred30

# Se já tiver o projeto
cd caminho/para/cred30
```

### 2. Instalar Dependências

```bash
# Instalar dependências do projeto principal
npm install

# Instalar dependências do backend
cd backend
npm install

# Voltar ao diretório principal
cd ..
```

### 3. Verificar Estrutura

```bash
# Estrutura esperada:
cred30/
├── backend/
│   ├── src/
│   ├── scripts/
│   ├── package.json
│   └── .env
├── components/
├── services/
├── App.tsx
├── package.json
├── .env.local
└── vite.config.ts
```

## 🗄️ Configuração do Banco de Dados

### Opção 1: PostgreSQL Nativo (Recomendado para desenvolvimento)

#### Windows:

```bash
# 1. Instalar PostgreSQL (se já não tiver)
# 2. Abrir SQL Shell (psql)
# 3. Criar banco de dados
CREATE DATABASE cred30;

# 4. Criar usuário
CREATE USER cred30user WITH PASSWORD 'cred30pass';

# 5. Dar permissões
GRANT ALL PRIVILEGES ON DATABASE cred30 TO cred30user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cred30user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cred30user;

# 6. Conectar ao banco
psql -h localhost -U cred30user -d cred30
```

#### macOS/Linux:

```bash
# 1. Iniciar serviço PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# 2. Criar banco e usuário
sudo -u postgres createdb cred30
sudo -u postgres createuser --interactive
# Respostas: cred30user, senha: cred30pass, superuser: n

# 3. Conectar
psql -h localhost -U cred30user -d cred30
```

### Opção 2: PostgreSQL com Docker (Alternativa)

```bash
# Criar docker-compose.yml
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

# Iniciar container
docker-compose up -d

# Verificar se está rodando
docker ps
```

## 🔧 Variáveis de Ambiente

### 1. Backend (.env)

```bash
# Criar arquivo backend/.env
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
NODE_ENV=development
JWT_SECRET=chave-super-secreta-desenvolvimento-123456789

# Configurações de Negócio
QUOTA_PRICE=50
LOAN_INTEREST_RATE=0.2
PENALTY_RATE=0.4
ADMIN_PIX_KEY=seu-pix-aqui
MIN_LOAN_AMOUNT=100
MAX_LOAN_AMOUNT=10000
EOF
```

### 2. Frontend (.env.local)

```bash
# Voltar ao diretório principal
cd ..

# Criar arquivo .env.local
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:3001/api
VITE_ENV=development
EOF
```

## 🗃️ Inicialização do Banco

### 1. Schema do Banco de Dados

```bash
# Usar script de inicialização
cd backend
node scripts/init-db-fixed.js

# Ou manualmente:
psql -h localhost -U cred30user -d cred30 -f scripts/init-db-fixed.sql
```

### 2. Verificar Schema

```bash
# Conectar ao banco
psql -h localhost -U cred30user -d cred30

# Listar tabelas
\dt

# Verificar estrutura de uma tabela
\d users
\d loans
\d quotas
```

## 🚀 Execução da Aplicação

### 1. Iniciar Backend

```bash
cd backend

# Opção 1: Com Bun (mais rápido)
npm install -g bun
bun run dev

# Opção 2: Com Node.js
npm run dev

# Opção 3: Modo simples
npm run dev-simple
```

### 2. Iniciar Frontend (em outro terminal)

```bash
# No diretório principal
npm run dev

# Ou com Bun
bun run dev
```

### 3. URLs de Acesso Local

```
Frontend: http://localhost:5173
Backend API: http://localhost:3001/api
Health Check: http://localhost:3001/api/health
```

## ✅ Verificação de Funcionamento

### 1. Testar Backend

```bash
# Health check
curl http://localhost:3001/api/health

# Deve retornar:
{"status": "ok", "timestamp": "2024-01-01T12:00:00.000Z"}
```

### 2. Testar Frontend

```bash
# Abrir no navegador
http://localhost:5173

# Verificar se carrega sem erros no console
```

### 3. Testar Conexão com Banco

```bash
# Conectar ao PostgreSQL
psql -h localhost -U cred30user -d cred30

# Verificar tabelas
\dt

# Consultar usuários
SELECT * FROM users;
```

### 4. Testar API Completa

```bash
# 1. Criar usuário admin
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Administrador",
    "email": "admin@cred30.com",
    "password": "admin123",
    "secretPhrase": "admin123",
    "pixKey": "admin@pix.com"
  }'

# 2. Fazer login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cred30.com",
    "password": "admin123",
    "secretPhrase": "admin123"
  }'

# 3. Verificar resposta (deve conter token)
```

## 🔄 Fluxo de Uso Completo

### 1. Primeiro Acesso

1. **Acesse o frontend**: http://localhost:5173
2. **Registre o primeiro usuário** (será o admin)
3. **Faça login** com as credenciais criadas
4. **Acesse o dashboard admin**: http://localhost:5173/admin

### 2. Operações Básicas

1. **Configurar sistema**: Defina preço das cotas, taxas, etc.
2. **Criar usuários teste**: Registre alguns clientes
3. **Comprar cotas**: Simule investimentos
4. **Solicitar empréstimos**: Teste o fluxo completo
5. **Aprovar operações**: Use o painel admin

### 3. Validação de Funcionalidades

```bash
# Checklist de verificação:
[ ] Registro de usuários funciona
[ ] Login/logout estável
[ ] Dashboard admin carrega
[ ] Dashboard cliente carrega
[ ] Compra de cotas funciona
[ ] Solicitação de empréstimos funciona
[ ] Aprovação de empréstimos funciona
[ ] Transações são registradas
[ ] Saques funcionam
[ ] Configurações do sistema persistem
```

## 🛠️ Desenvolvimento e Debug

### 1. Logs do Backend

```bash
# Logs aparecem no terminal onde executou `npm run dev`
# Para verbosidade adicional
DEBUG=* npm run dev
```

### 2. Logs do Frontend

```bash
# Logs aparecem no terminal onde executou `npm run dev`
# Erros de TypeScript/React aparecem no console do navegador
```

### 3. Acesso ao Banco Direto

```bash
# Conectar ao PostgreSQL
psql -h localhost -U cred30user -d cred30

# Comandos úteis:
\l - Listar bancos
\dt - Listar tabelas
\d nome_tabela - Descrever tabela
SELECT * FROM users LIMIT 5; - Consultar dados
```

### 4. Debug com VS Code

```bash
# 1. Abra o projeto no VS Code
code .

# 2. Use o depurador:
# - Breakpoints no backend (F9)
# - Console do navegador para frontend
# - Network tab para requisições HTTP
# - PostgreSQL extension para consultas SQL
```

## 🚨 Solução de Problemas

### 1. Porta em Uso

```bash
# Verificar portas
netstat -an | grep :5173
netstat -an | grep :3001
netstat -an | grep :5432

# Matar processo se necessário
# Windows:
taskkill /PID <PID> /F
# Linux/macOS:
kill -9 <PID>
```

### 2. PostgreSQL Não Conecta

```bash
# Verificar se serviço está rodando
# Windows:
Get-Service postgresql*
# Linux:
sudo systemctl status postgresql
# macOS:
brew services list | grep postgresql

# Reiniciar serviço
# Windows:
Start-Service postgresql*
# Linux:
sudo systemctl restart postgresql
# macOS:
brew services restart postgresql
```

### 3. Erros de Permissão

```bash
# PostgreSQL: ERROR: permission denied for database
# Solução:
psql -h localhost -U postgres -d postgres
GRANT ALL PRIVILEGES ON DATABASE cred30 TO cred30user;
```

### 4. Dependências Não Instalam

```bash
# Limpar cache npm
npm cache clean --force

# Remover node_modules
rm -rf node_modules package-lock.json

# Reinstalar
npm install
```

### 5. Frontend Não Conecta no Backend

```bash
# Verificar se backend está rodando
curl http://localhost:3001/api/health

# Verificar variável de ambiente
cat .env.local

# Verificar configuração CORS no backend
# Deve incluir: http://localhost:5173
```

### 6. Erros de Build/TypeScript

```bash
# Verificar tipos
npm run type-check

# Limpar build
rm -rf dist

# Rebuildar
npm run build
```

## 📊 Monitoramento em Desenvolvimento

### 1. Recursos do Sistema

```bash
# Uso de CPU/Memória
# Windows: Task Manager
# macOS: Activity Monitor
# Linux: htop

# Uso de disco
df -h

# Uso de rede
netstat -an
```

### 2. Performance do Banco

```bash
# Conectar ao PostgreSQL
psql -h localhost -U cred30user -d cred30

# Verificar queries lentas
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Verificar tamanho das tabelas
SELECT
    schemaname,
    tablename,
    pg_size_pretty(tablename) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_size_pretty(tablename) DESC;
```

### 3. Logs Estruturados

```bash
# Adicionar logging ao backend
# Em backend/src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

module.exports = logger;
```

## 🔄 Fluxo de Trabalho Recomendado

### 1. Setup Inicial (Primeira vez)

```bash
# 1. Clonar projeto
git clone <URL>
cd cred30

# 2. Instalar dependências
npm install
cd backend && npm install && cd ..

# 3. Configurar banco de dados
# Seguir instruções da seção "Configuração do Banco de Dados"

# 4. Configurar variáveis de ambiente
# Criar arquivos .env e .env.local

# 5. Inicializar banco
cd backend && node scripts/init-db-fixed.js

# 6. Iniciar aplicações
# Terminal 1: cd backend && npm run dev
# Terminal 2: npm run dev
```

### 2. Desenvolvimento Diário

```bash
# 1. Iniciar PostgreSQL (se não for Docker)
# 2. Iniciar backend (cd backend && npm run dev)
# 3. Iniciar frontend (npm run dev)
# 4. Desenvolver/testar
# 5. Commit das mudanças
git add .
git commit -m "feat: nova funcionalidade"
```

### 3. Boas Práticas

```bash
# 1. Usar branches para features
git checkout -b feature/nova-funcionalidade

# 2. Code review antes de merge
git pull-request main

# 3. Manter dependências atualizadas
npm audit fix
npm update

# 4. Testes automatizados
npm test

# 5. Limpeza periódica
npm cache clean --force
```

## 📚 Recursos Adicionais

### Documentação

- [Documentação da API](./DOCUMENTACAO_CLIENTE_BACKEND.md)
- [Guia do Administrador](./INSTRUCOES-ADMIN.md)
- [Relatório de Análise](./RELATORIO_COMPLETO_ANALISE_CRED30.md)

### Ferramentas Úteis

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [React Documentation](https://react.dev/)
- [VS Code Documentation](https://code.visualstudio.com/docs)

### Extensões VS Code Recomendadas

- PostgreSQL
- Thunder Client (para testar APIs)
- ES7+ React/Redux/React-Native snippets
- Prettier
- ESLint
- GitLens

---

## 🎉 Conclusão

Com este guia você tem:

- ✅ **Ambiente completo** configurado localmente
- ✅ **Banco PostgreSQL real** sem dados de teste
- ✅ **Instruções detalhadas** passo a passo
- ✅ **Soluções de problemas** comuns
- ✅ **Fluxo de trabalho** otimizado

A plataforma CRED30 está pronta para desenvolvimento local completo e profissional!

### Próximos Passos:

1. **Siga este guia** passo a passo
2. **Desenvolva suas funcionalidades**
3. **Teste localmente** antes de compartilhar
4. **Use controle de versão** (git) para rastrear mudanças
5. **Considere deploy** quando estiver satisfeito com o desenvolvimento
