# Guia Rápido: CRED30 com ngrok

Este guia mostra como configurar o CRED30 para acesso externo usando ngrok, permitindo que você compartilhe a plataforma com usuários de teste em qualquer lugar.

## 🚀 Início Rápido (5 minutos)

### Pré-requisitos

- Docker Desktop instalado e rodando
- ngrok instalado (`npm install -g ngrok` ou baixe de https://ngrok.com/download)
- Conta ngrok gratuita (já autenticada)

### Passo 1: Usar o Script Automático

#### Windows:

```bash
start-ngrok.bat
```

#### Linux/Mac:

```bash
chmod +x start-ngrok.sh
./start-ngrok.sh
```

O script irá:

- Iniciar todos os containers Docker
- Configurar o banco de dados
- Iniciar ngrok para frontend e backend
- Exibir as URLs públicas

### Passo 2: Acessar a Plataforma

Após o script terminar, você verá URLs como:

```
Frontend: https://abcd-1234-5678.ngrok-free.app
Backend:  https://efgh-9012-3456.ngrok-free.app
```

Acesse:

- **Dashboard Admin**: `[URL Frontend]/admin`
- **Dashboard Cliente**: `[URL Frontend]`

### Credenciais de Teste:

```
Admin: admin@cred30.com / admin123
Cliente: joao@cred30.com / cliente123
```

## 🛠️ Configuração Manual

Se preferir configurar manualmente:

### 1. Iniciar Containers

```bash
docker-compose -f docker-compose.ngrok.yml up -d
```

### 2. Aguardar Serviços

Aguarde 30-60 segundos para todos os serviços iniciarem.

### 3. Iniciar ngrok

```bash
# Frontend (porta 5173)
ngrok http 5173

# Backend (porta 3001) - em outro terminal
ngrok http 3001
```

### 4. Popular Dados de Teste

```bash
cd backend
node scripts/populate-test-data.js
```

## 📱 Compartilhando com Usuários

### Links para Compartilhar:

- **Link do Cliente**: `https://[seu-ngrok-id].ngrok-free.app`
- **Link do Admin**: `https://[seu-ngrok-id].ngrok-free.app/admin`

### Instruções para Usuários:

1. Acesse o link fornecido
2. Use as credenciais de teste
3. Explore as funcionalidades disponíveis

## 🔧 Personalização

### Alterar Portas:

Edite `docker-compose.ngrok.yml`:

```yaml
services:
  frontend:
    ports:
      - "8080:5173" # Muda porta externa para 8080
```

### Configurações do ngrok:

Crie arquivo `ngrok.yml`:

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

Use com: `ngrok start --all --config ngrok.yml`

## 📊 Monitoramento

### Ver Logs:

```bash
# Logs de todos os serviços
docker-compose -f docker-compose.ngrok.yml logs -f

# Logs específicos
docker-compose -f docker-compose.ngrok.yml logs -f frontend
docker-compose -f docker-compose.ngrok.yml logs -f backend
```

### Ver Status dos Containers:

```bash
docker-compose -f docker-compose.ngrok.yml ps
```

## 🛡️ Segurança com ngrok

### Limitações do Plano Gratuito:

- URLs aleatórias a cada sessão
- Limites de uso (conexões simultâneas)
- Sem domínio personalizado

### Recomendações:

1. **Use apenas para testes**: Não exponha dados reais
2. **Limite o tempo**: Mantenha ngrok ativo apenas quando necessário
3. **Monitore acessos**: Verifique logs regularmente
4. **Senhas fortes**: Use credenciais diferentes para produção

## 🔄 Reiniciar Serviços

### Parar Tudo:

```bash
docker-compose -f docker-compose.ngrok.yml down
```

### Reiniciar com Dados Novos:

```bash
# Parar e limpar
docker-compose -f docker-compose.ngrok.yml down -v

# Iniciar novamente
docker-compose -f docker-compose.ngrok.yml up -d

# Popular dados
cd backend && node scripts/populate-test-data.js
```

## 🚨 Solução de Problemas

### ngrok não inicia:

- Verifique se está autenticado: `ngrok config check`
- Verifique se a porta está livre: `netstat -an | grep 5173`

### Containers não iniciam:

- Verifique Docker Desktop: `docker info`
- Verifique portas em uso: `docker ps`

### Frontend não carrega:

- Aguarde mais tempo (pode demorar para compilar)
- Verifique logs: `docker-compose logs frontend`

### Backend não responde:

- Verifique conexão com banco: `docker-compose logs backend`
- Reinicie o backend: `docker-compose restart backend`

## 📈 Próximos Passos

1. **Teste Completo**: Valide todas as funcionalidades
2. **Feedback**: Colete feedback dos usuários
3. **Melhorias**: Implemente sugestões recebidas
4. **Produção**: Considere hospedagem profissional

## 🔗 Links Úteis

- [Documentação ngrok](https://ngrok.com/docs)
- [Docker Compose](https://docs.docker.com/compose/)
- [Guia Principal CRED30](./GUIA_IMPLEMENTACAO_ZEROCOST.md)
- [Relatório Completo](./RELATORIO_COMPLETO_ANALISE_CRED30.md)

---

## 💡 Dica Pro

Para testes contínuos, considere configurar um webhook no ngrok para receber notificações quando a URL mudar, ou use o plano pago para obter subdomínios fixos.
