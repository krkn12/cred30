# Cred30 Backend

Backend da plataforma fintech Cred30, construído com Bun, Hono e MongoDB Atlas.

## Tecnologias

- **Runtime**: Bun
- **Framework Web**: Hono
- **Banco de Dados**: MongoDB Atlas
- **Autenticação**: JWT
- **Validação**: Zod
- **Segurança**: bcrypt

## Instalação

1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/cred30.git
cd cred30/backend
```

2. Instale as dependências
```bash
bun install
```

3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
- `MONGODB_URI`: String de conexão com o MongoDB Atlas
- `JWT_SECRET`: Chave secreta para assinatura dos tokens JWT
- `GEMINI_API_KEY`: Chave da API do Google Gemini para o assistente de IA

## Execução

Para desenvolvimento:
```bash
bun run dev
```

Para produção:
```bash
bun run build
bun run start
```

O servidor será iniciado na porta definida em `.env` (padrão: 3001)

## Estrutura do Projeto

```
backend/
├── src/
│   ├── index.ts          # Arquivo principal do servidor
│   ├── models/           # Modelos de dados
│   │   ├── User.ts
│   │   ├── Quota.ts
│   │   ├── Loan.ts
│   │   ├── Transaction.ts
│   │   └── AppState.ts
│   ├── routes/           # Rotas da API
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── quotas.ts
│   │   ├── loans.ts
│   │   ├── transactions.ts
│   │   └── admin.ts
│   ├── middleware/       # Middlewares
│   │   └── auth.ts
│   └── utils/            # Utilitários
│       └── constants.ts
├── .env.example          # Exemplo de variáveis de ambiente
├── package.json
├── tsconfig.json
└── README.md
```

## Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login de usuário
- `POST /api/auth/register` - Registro de novo usuário
- `POST /api/auth/reset-password` - Redefinição de senha
- `POST /api/auth/logout` - Logout

### Usuários
- `GET /api/users/profile` - Obter perfil do usuário
- `PUT /api/users/profile` - Atualizar perfil do usuário

### Cotas
- `GET /api/quotas` - Listar cotas do usuário
- `POST /api/quotas/buy` - Comprar cotas
- `POST /api/quotas/sell` - Vender cotas
- `POST /api/quotas/sell-all` - Vender todas as cotas

### Empréstimos
- `GET /api/loans` - Listar empréstimos do usuário
- `POST /api/loans/request` - Solicitar empréstimo
- `POST /api/loans/repay` - Pagar empréstimo

### Transações
- `GET /api/transactions` - Listar transações do usuário
- `POST /api/transactions/withdraw` - Solicitar saque

### Administração
- `GET /api/admin/dashboard` - Dashboard administrativo
- `GET /api/admin/pending` - Listar itens pendentes
- `POST /api/admin/approve` - Aprovar transação/empréstimo
- `POST /api/admin/reject` - Rejeitar transação/empréstimo
- `POST /api/admin/system-balance` - Atualizar saldo do sistema
- `POST /api/admin/profit-pool` - Adicionar lucro ao pool
- `POST /api/admin/distribute-dividends` - Distribuir dividendos

## Deploy em VPS

Para fazer o deploy em uma VPS de R$30/mensais:

1. Conecte-se à sua VPS via SSH
2. Instale o Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

3. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/cred30.git
cd cred30/backend
```

4. Instale as dependências:
```bash
bun install
```

5. Configure as variáveis de ambiente:
```bash
cp .env.example .env
nano .env
```

6. Build da aplicação:
```bash
bun run build
```

7. Para manter a aplicação rodando em segundo plano, instale o PM2:
```bash
npm install -g pm2
```

8. Inicie a aplicação com PM2:
```bash
pm2 start dist/index.js --name "cred30-backend"
```

9. Configure o PM2 para iniciar com o sistema:
```bash
pm2 startup
pm2 save
```

## Segurança

- Todas as senhas são hasheadas com bcrypt
- Tokens JWT com expiração de 24 horas
- Validação de entrada com Zod
- CORS configurado para aceitar apenas origens permitidas