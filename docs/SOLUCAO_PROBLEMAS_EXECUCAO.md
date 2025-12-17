# Solução Completa para Problemas de Execução e Configuração

## 🚨 Problemas Identificados

### 1. Erro de Módulo Não Encontrado

```
Error: Cannot find module './src/infrastructure/database/postgresql/connection/pool'
```

### 2. Limite de Sessão ngrok

```
ERROR: authentication failed: Your account is limited to 1 simultaneous ngrok agent sessions.
```

## ✅ Soluções Implementadas

### Solução 1: Script de Limpeza Corrigido

O problema ocorre porque o script `clear-expired-tokens.js` está tentando importar módulos TypeScript diretamente com Node.js.

#### Arquivo Corrigido

- **Nome**: `backend/clear-expired-tokens-fixed.js`
- **Correção**: Usa apenas módulos CommonJS compatíveis com Node.js

#### Como Usar

```bash
# No diretório backend
node clear-expired-tokens-fixed.js
```

### Solução 2: Gerenciamento de Sessão ngrok

Criei um script completo para resolver o limite de sessão do ngrok.

#### Arquivo de Solução

- **Nome**: `fix-ngrok-session-limit.js`
- **Funcionalidades**:
  - Verifica instalação do ngrok
  - Mata processos ngrok existentes
  - Limpa configuração do ngrok
  - Fornece instruções para uso correto

## 🚀 Instruções Passo a Passo

### Para Resolver o Problema do Script

1. **Use o script corrigido**:

   ```bash
   cd backend
   node clear-expired-tokens-fixed.js
   ```

2. **Ou execute diretamente com o pool PostgreSQL**:
   ```bash
   cd backend
   node -e "
   const { Pool } = require('pg');
   const pool = new Pool({
     host: 'localhost',
     port: 5432,
     user: 'cred30user',
     password: 'cred30pass',
     database: 'cred30'
   });
   pool.query('SELECT NOW()').then(() => {
     console.log('✅ Conexão com PostgreSQL funcionando!');
     pool.end();
   }).catch(console.error);
   "
   ```

### Para Resolver o Problema do ngrok

1. **Execute o script de solução**:

   ```bash
   node fix-ngrok-session-limit.js
   ```

2. **Use a configuração de ngrok único**:

   ```bash
   # Windows
   start-single-ngrok.bat

   # Linux/Mac
   chmod +x start-single-ngrok.sh
   ./start-single-ngrok.sh
   ```

3. **Alternativa manual**:

   ```bash
   # Matar todos os processos ngrok
   # Windows
   taskkill /f /im ngrok.exe

   # Linux/Mac
   pkill -f ngrok

   # Limpar configuração
   rm -rf ~/.ngrok2/

   # Iniciar com configuração limpa
   ngrok http 5173 --log=stdout
   ```

## 🔧 Configuração Recomendada

### Para Desenvolvimento Local

1. **Use Docker Compose com ngrok único**:

   ```bash
   docker-compose -f docker-compose.single-ngrok.yml up -d
   ngrok http 5173
   ```

2. **Variáveis de Ambiente**:
   ```bash
   # No arquivo .env
   VITE_API_URL=/api
   NODE_ENV=development
   ```

### Para Testes com ngrok

1. **Apenas um túnel por vez**:

   ```bash
   # Frontend + Backend via proxy
   ngrok http 5173

   # URLs resultantes:
   # Frontend: https://abc123.ngrok-free.app
   # API: https://abc123.ngrok-free.app/api
   ```

2. **Verificação de funcionamento**:

   ```bash
   # Testar frontend
   curl https://SEU_NGROK.ngrok-free.app

   # Testar API via proxy
   curl https://SEU_NGROK.ngrok-free.app/api/health
   ```

## 🛠️ Scripts Úteis

### Verificar Conexão PostgreSQL

```bash
cd backend
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});
pool.query('SELECT COUNT(*) FROM users').then(result => {
  console.log('Usuários no banco:', result.rows[0].count);
  pool.end();
}).catch(console.error);
"
```

### Limpar e Resetar Banco

```bash
cd backend
node scripts/reset-database-completely.js
```

### Verificar Status dos Serviços

```bash
# Ver containers Docker
docker-compose -f docker-compose.single-ngrok.yml ps

# Ver logs
docker-compose -f docker-compose.single-ngrok.yml logs -f

# Testar saúde da API
curl http://localhost:5173/api/health
```

## 📋 Checklist de Resolução

- [ ] Usar `clear-expired-tokens-fixed.js` em vez do original
- [ ] Matar todos os processos ngrok antes de iniciar novo
- [ ] Limpar configuração do ngrok se necessário
- [ ] Usar `start-single-ngrok.bat` para configuração automática
- [ ] Manter apenas uma instância ngrok ativa
- [ ] Verificar se Docker está rodando antes dos scripts
- [ ] Confirmar que PostgreSQL está acessível

## 🎯 Próximos Passos

1. **Execute os scripts corrigidos**
2. **Teste a conexão localmente**
3. **Use ngrok único para acesso externo**
4. **Compartilhe apenas uma URL com usuários teste**

## 📞 Suporte Rápido

Se ainda tiver problemas:

1. **Verifique logs completos**:

   ```bash
   docker-compose -f docker-compose.single-ngrok.yml logs
   ```

2. **Teste conexão direta**:

   ```bash
   curl http://localhost:5173
   curl http://localhost:3001/api/health
   ```

3. **Reinicie tudo do zero**:
   ```bash
   docker-compose -f docker-compose.single-ngrok.yml down -v
   docker system prune -f
   start-single-ngrok.bat
   ```

Com estas soluções, você deverá conseguir executar o sistema Cred30 sem os problemas de módulo e limite de sessão ngrok.
