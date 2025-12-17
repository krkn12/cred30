# Guia Completo: CRED30 com ngrok Único (Plano Gratuito)

Este guia mostra como configurar o CRED30 usando apenas **uma instância do ngrok** através de proxy reverso, perfeito para o plano gratuito.

## 🎯 Problema Resolvido

No plano gratuito do ngrok, você só pode usar **uma instância simultânea**. Esta solução usa:

- **Proxy reverso** no frontend para redirecionar requisições da API
- **Apenas um túnel ngrok** para o frontend (porta 5173)
- **Backend acessível** através do proxy: `/api/*`

## 📋 Arquivos Necessários

### Configuração

- **`docker-compose.single-ngrok.yml`** - Docker com proxy configurado
- **`vite.config.proxy.js`** - Configuração Vite com proxy reverso

### Scripts

- **`start-single-ngrok.sh`** - Script automatizado (Linux/Mac)
- **`start-single-ngrok.bat`** - Script automatizado (Windows)
- **`test-single-ngrok.js`** - Testes de integração

## 🚀 Início Rápido (3 minutos)

### Windows:

```bash
start-single-ngrok.bat
```

### Linux/Mac:

```bash
chmod +x start-single-ngrok.sh
./start-single-ngrok.sh
```

## 🔧 Como Funciona

### Arquitetura com Proxy

```
Usuário → ngrok → Frontend (5173) → Proxy → Backend (3001)
                     ↓
                 Todas as requisições
                     ↓
              Uma única URL ngrok
```

### Fluxo de Requisições

1. **Frontend**: Acessado diretamente via ngrok
2. **API**: Acessada via `/api/*` → proxy para backend
3. **Recursos Estáticos**: Servidos pelo frontend

### URLs Finais

Após executar os scripts, você terá:

```
Frontend:    https://abc123.ngrok-free.app
API:         https://abc123.ngrok-free.app/api
Admin:        https://abc123.ngrok-free.app/admin
```

## 📱 Acesso e Testes

### Credenciais

```
Admin:  admin@cred30.com / admin123
Cliente: joao@cred30.com / cliente123
```

### Teste Automático

```bash
node test-single-ngrok.js

# Com URL específica:
FRONTEND_URL=https://abc123.ngrok-free.app node test-single-ngrok.js
```

### Teste Manual

```bash
# Frontend
curl https://SEU_NGROK.ngrok-free.app

# API via proxy
curl https://SEU_NGROK.ngrok-free.app/api/health

# Login
curl -X POST https://SEU_NGROK.ngrok-free.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cred30.com","password":"admin123"}'
```

## 🛠️ Configuração Detalhada

### 1. Docker Compose

O `docker-compose.single-ngrok.yml` configura:

- **Frontend**: Porta 5173 com variável `VITE_API_URL=/api`
- **Backend**: Porta 3001 acessível apenas via rede interna
- **Proxy**: Configurado no Vite para redirecionar `/api` → `backend:3001`

### 2. Vite Config

O `vite.config.proxy.js` define:

```javascript
proxy: {
  '/api': {
    target: 'http://backend:3001',
    changeOrigin: true,
    secure: false
  }
}
```

### 3. Variáveis de Ambiente

Frontend usa `VITE_API_URL=/api` (relativa) em vez de URL absoluta.

## 🔍 Validação de Funcionamento

### Checklist de Verificação

- [ ] Frontend carrega via ngrok
- [ ] API responde via `/api/health`
- [ ] Login funciona corretamente
- [ ] Dashboard admin acessível
- [ ] Dashboard cliente funcional
- [ ] Operações de CRUD funcionam

### Comandos de Verificação

```bash
# Ver status dos containers
docker-compose -f docker-compose.single-ngrok.yml ps

# Ver logs
docker-compose -f docker-compose.single-ngrok.yml logs -f

# Testar proxy localmente
curl http://localhost:5173/api/health

# Ver túnel ngrok
curl http://localhost:4040/api/tunnels
```

## ⚡ Vantagens desta Abordagem

### Técnica

- ✅ **Apenas um túnel ngrok** (compatível com plano gratuito)
- ✅ **Proxy reverso transparente** (sem mudanças no frontend)
- ✅ **Backend isolado** (acesso apenas via proxy)
- ✅ **Configuração automática** (scripts fazem tudo)

### Prática

- ✅ **URL única** para frontend e backend
- ✅ **Fácil compartilhamento** (apenas um link)
- ✅ **Setup rápido** (3 minutos)
- ✅ **Zero custo** (usa apenas ferramentas gratuitas)

## 🚨 Limitações e Soluções

### Limitações do ngrok Gratuito

- **1 hora por sessão**: Script pode reiniciar automaticamente
- **URL aleatória**: Muda a cada reinício
- **40 conexões simultâneas**: Adequado para testes pequenos
- **1GB/mês**: Suficiente para validação

### Soluções Implementadas

```bash
# Reinício automático (adicione ao script)
while true; do
  ngrok http 5173
  sleep 5
done
```

## 🔒 Segurança

### Considerações

- ✅ **Adequado para testes**: Dados simulados e controlados
- ⚠️ **URL pública**: Qualquer pessoa com link pode acessar
- ⚠️ **Não usar produção**: Apenas para validação

### Recomendações

1. **Dados de teste apenas**: Nunca use dados reais
2. **Monitore acessos**: Verifique logs regularmente
3. **Tempo limitado**: Mantenha ngrok ativo apenas quando necessário
4. **Senhas fortes**: Use credenciais diferentes para produção

## 🔄 Manutenção

### Comandos Úteis

```bash
# Parar tudo
docker-compose -f docker-compose.single-ngrok.yml down

# Reiniciar serviços
docker-compose -f docker-compose.single-ngrok.yml restart

# Limpar tudo
docker-compose -f docker-compose.single-ngrok.yml down -v
docker system prune -f

# Repopular dados
cd backend && node scripts/populate-test-data.js
```

### Backup e Restauração

```bash
# Backup do banco
docker exec cred30-db-single pg_dump -U cred30user cred30 > backup.sql

# Restaurar
docker exec -i cred30-db-single psql -U cred30user cred30 < backup.sql
```

## 📈 Próximos Passos

### Validação Imediata

1. **Execute os scripts**: `start-single-ngrok.sh/.bat`
2. **Teste localmente**: Verifique funcionamento básico
3. **Compartilhe URL**: Envie para 5-10 usuários teste
4. **Colete feedback**: Use formulário ou entrevistas

### Para Produção

Quando validar o conceito:

1. **Hospedagem profissional**: DigitalOcean, Railway, etc.
2. **Domínio personalizado**: Configure DNS e SSL
3. **Banco gerenciado**: PostgreSQL, MongoDB Atlas
4. **Monitoramento**: Sentry, Analytics, etc.

## 🆚 Comparação: ngrok Único vs Duplo

| Característica     | ngrok Único (Proxy) | ngrok Duplo     |
| ------------------ | ------------------- | --------------- |
| **Túneis**         | 1 ✅                | 2 ❌            |
| **Plano Gratuito** | ✅ Compatível       | ❌ Incompatível |
| **Setup**          | 3 minutos           | 5 minutos       |
| **URLs**           | 1 única             | 2 separadas     |
| **Complexidade**   | Baixa               | Média           |
| **Performance**    | Excelente           | Excelente       |

## 📞 Suporte e Problemas Comuns

### Problemas Frequentes

**ngrok não inicia:**

```bash
# Verificar autenticação
ngrok config check

# Verificar instalação
ngrok version
```

**Proxy não funciona:**

```bash
# Verificar configuração Vite
cat vite.config.proxy.js

# Testar proxy manualmente
curl http://localhost:5173/api/health
```

**CORS errors:**

```javascript
// Verificar se backend aceita origin do ngrok
app.use(
  cors({
    origin: ["https://SEU_NGROK.ngrok-free.app"],
  })
);
```

### Recursos de Ajuda

- [Guia Principal](./GUIA_IMPLEMENTACAO_ZEROCOST.md)
- [Script de Testes](./test-single-ngrok.js)
- [Relatório de Análise](./RELATORIO_COMPLETO_ANALISE_CRED30.md)

---

## 🎉 Conclusão

Com esta configuração você tem:

- ✅ **Acesso externo** com apenas uma instância ngrok
- ✅ **Proxy reverso** transparente e eficiente
- ✅ **Setup automatizado** com scripts completos
- ✅ **Testes robustos** para validação
- ✅ **Documentação completa** para suporte

A plataforma CRED30 está pronta para validação com usuários reais usando apenas o plano gratuito do ngrok!
