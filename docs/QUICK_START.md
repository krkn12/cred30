# 🚀 GUIA RÁPIDO DE START - CRED30 ZERO-COST

## ⚡ START IMEDIATO (5 minutos)

### 1. Pré-requisitos

```bash
# Verificar Node.js (v18+)
node --version

# Verificar Git
git --version

# Se não tiver, instale em https://nodejs.org
```

### 2. Clonar e Configurar

```bash
# Clonar o projeto
git clone <URL-DO-REPOSITORIO>
cd cred30

# Instalar dependências do backend
cd backend
npm install

# Instalar dependências do frontend
cd ..
npm install

# Voltar para raiz
cd .
```

### 3. Iniciar Banco de Dados (PostgreSQL)

```bash
# Opção A: Docker (Recomendado)
docker-compose -f docker-compose.local.yml up -d postgres

# Opção B: PostgreSQL local
# Iniciar seu PostgreSQL local
```

### 4. Configurar Variáveis de Ambiente

```bash
# Backend
cd backend
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_USER=cred30user
DB_PASSWORD=cred30pass
DB_DATABASE=cred30
PORT=3001
JWT_SECRET=chave-super-secreta-dev-123456789
NODE_ENV=development
QUOTA_PRICE=50
LOAN_INTEREST_RATE=0.2
PENALTY_RATE=0.4
ADMIN_PIX_KEY=seu-pix-aqui
EOF

# Frontend
cd ..
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:3001/api
VITE_ENV=development
EOF
```

### 5. Iniciar Aplicação

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
npm run dev

# Acessar:
# Frontend: http://localhost:5173
# Backend: http://localhost:3001/api
```

---

## 🔐 ACESSO INICIAL

### Usuário Administrador

- **Email**: `admin@cred30.local`
- **Senha**: `admin123`
- **Frase Secreta**: `admin`
- **Acesso**: Painel administrativo completo

### Usuários de Teste

- **Email**: `teste1@cred30.local` | **Senha**: `teste123` | **Frase**: `teste123`
- **Email**: `teste2@cred30.local` | **Senha**: `teste123` | **Frase**: `teste123`
- **Email**: `teste3@cred30.local` | **Senha**: `teste123` | **Frase**: `teste123`

---

## 🧪 TESTES RÁPIDOS

### Teste 1: Registrar Novo Usuário

1. Acesse http://localhost:5173
2. Clique em "Criar Agora"
3. Preencha formulário e registre-se
4. Faça login com novas credenciais

### Teste 2: Comprar Cotas

1. Após login, clique em "Investir"
2. Selecione quantidade e método "Usar Saldo"
3. Confirme compra
4. Verifique no painel admin

### Teste 3: Solicitar Empréstimo

1. Clique em "Empréstimos"
2. Preencha valor e parcelas
3. Adicione chave PIX
4. Aguarde aprovação no painel admin

### Teste 4: Aprovar Operações (Admin)

1. Faça login como admin
2. Acesse painel administrativo
3. Aprove compras e empréstimos pendentes
4. Verifique saldos atualizados

---

## 🛠️ COMANDOS ÚTEIS

### Resetar Banco de Dados

```bash
cd backend
npm run db-reset
```

### Inserir Dados de Teste

```bash
cd backend
npm run seed
```

### Verificar Logs

```bash
# Logs do backend
cd backend && npm run dev

# Logs do frontend
npm run dev
```

### Verificar Conexões

```bash
# Verificar portas em uso
netstat -tulpn | grep :3001  # Backend
netstat -tulpn | grep :5173  # Frontend
netstat -tulpn | grep :5432  # PostgreSQL
```

---

## 🌍 EXPOSIÇÃO EXTERNA (ngrok)

### 1. Instalar ngrok

```bash
npm install -g ngrok
```

### 2. Expor Backend

```bash
# Terminal 1: Manter backend rodando
cd backend && npm run dev

# Terminal 2: Expor com ngrok
ngrok http 3001

# Copiar URL gerada (ex: https://abc123.ngrok-free.app)
```

### 3. Configurar Frontend

```bash
# Atualizar .env.local
VITE_API_URL=https://abc123.ngrok-free.app/api
```

### 4. Acessar Externamente

- **Frontend**: http://localhost:5173
- **API Externa**: https://abc123.ngrok-free.app/api

---

## 📱 ACESSO MOBILE

### Para testar no celular:

1. Configure ngrok (passo anterior)
2. Acesse http://localhost:5173 no computador
3. No celular, acesse a mesma URL ngrok
4. Teste todas as funcionalidades

---

## 🚨 SOLUÇÃO DE PROBLEMAS

### Porta em Uso

```bash
# Matar processo na porta
sudo fuser -k 3001/tcp  # Backend
sudo fuser -k 5173/tcp  # Frontend
sudo fuser -k 5432/tcp  # PostgreSQL

# Ou usar portas diferentes
# Backend: edite .env > PORT=3002
# Frontend: Vite usará porta automática
```

### PostgreSQL Não Conecta

```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Reiniciar PostgreSQL
docker-compose restart postgres

# Verificar logs
docker logs cred30-db-local
```

### CORS Errors

```bash
# Verificar configuração no backend/src/index.ts
# Garantir que sua URL está no origins permitidos

# Exemplo para ngrok:
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://abc123.ngrok-free.app'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
```

### Frontend Não Acessa Backend

```bash
# Verificar se backend está rodando
curl http://localhost:3001/api/health

# Verificar variável de ambiente
cat .env.local | grep VITE_API_URL

# Limpar cache do navegador
# Ctrl+Shift+R (Chrome/Firefox)
```

---

## 📊 MONITORAMENTO LOCAL

### Health Checks

```bash
# Backend
curl http://localhost:3001/api/health

# PostgreSQL
docker exec cred30-db-local pg_isready -U cred30user -d cred30
```

### Logs em Tempo Real

```bash
# Backend com watch
cd backend && npm run dev

# Frontend com watch
npm run dev

# Docker logs
docker-compose -f docker-compose.local.yml logs -f
```

---

## 🎯 CHECKLIST DE VALIDAÇÃO

### Funcionalidades Básicas

- [ ] Registro de usuários funciona
- [ ] Login com JWT funciona
- [ ] Compra de cotas funciona
- [ ] Visualização de portfólio funciona
- [ ] Solicitação de empréstimos funciona
- [ ] Painel admin funciona
- [ ] Aprovações funcionam corretamente

### Fluxos Completos

- [ ] Registro → Login → Compra de Cotas
- [ ] Login → Solicitação de Empréstimo → Aprovação
- [ ] Admin → Aprovação → Saldo Atualizado
- [ ] Venda de Cotas → Multa Aplicada

### Performance

- [ ] Carregamento da página < 3 segundos
- [ ] Operações respondem < 2 segundos
- [ ] Sem erros no console
- [ ] Banco de dados responde bem

---

## 🚀 PRÓXIMOS PASSOS

### Quando Validar o Conceito:

1. **Coletar Feedback**: 10-15 usuários reais
2. **Métricas**: Tempo de uso, conversão, erros
3. **Ajustes**: Corrigir bugs e melhorias
4. **Escala**: Considerar migração para servidor pago

### Migração para Produção (Low-Cost):

1. **DigitalOcean**: $5/mês
2. **Vultr**: $3.50/mês
3. **Railway**: $5/mês (com PostgreSQL)

---

## 📞 SUPORTE

### Problemas Comuns:

- **Erro de conexão**: Verifique se PostgreSQL está rodando
- **CORS**: Verifique configuração de origins
- **Portas**: Use netstat para verificar ocupação
- **Permissões**: Verifique permissões de arquivo/diretório

### Recursos:

- **Documentação**: [`GUIA_IMPLEMENTACAO_ZEROCOST.md`](GUIA_IMPLEMENTACAO_ZEROCOST.md)
- **Análise Completa**: [`RELATORIO_COMPLETO_ANALISE_CRED30.md`](RELATORIO_COMPLETO_ANALISE_CRED30.md)
- **Código Fonte**: Repositório GitHub

---

## 🎉 SUCESSO!

Se você chegou até aqui, já tem uma plataforma financeira funcional rodando no seu laptop completamente sem custos!

**Próximos passos recomendados:**

1. Teste com 3-5 amigos/familiares
2. Coletar feedback real
3. Fazer ajustes necessários
4. Planejar migração para produção quando validar o modelo

Parabéns pela implementação zero-cost do CRED30! 🚀
