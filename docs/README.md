# Cred30 - Plataforma Fintech

Cred30 é uma plataforma financeira que permite investimentos em cotas com rendimentos diários, empréstimos pessoais e sistema de indicações.

## Funcionalidades

- 🏦 **Investimento em Cotas**: Compre cotas a R$ 50,00 cada e receba rendimentos diários
- 💰 **Empréstimos Pessoais**: Solicite empréstimos com juros de 20% ao mês
- 👥 **Saque de Valores**: Transfira seu saldo para sua conta bancária
- 🎯 **Sistema de Indicação**: Ganhe R$ 5,00 por cada amigo indicado
- 👑 **Níveis VIP**: Bronze, Prata e Ouro com benefícios exclusivos
- 🤖 **Assistente IA**: Receba dicas financeiras personalizadas

## Tecnologias

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Hono + TypeScript + PostgreSQL
- **Autenticação**: JWT
- **Estilo**: Dark mode com design moderno

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- npm ou yarn

## Configuração do Ambiente

1. Clone o repositório:

```bash
git clone <url-do-repositorio>
cd cred30
```

2. Instale as dependências:

```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

3. Configure as variáveis de ambiente:

```bash
# Copie o arquivo .env.example para .env
cp .env.example .env
```

## Executando o Projeto

### 1. Inicie o Banco de Dados

```bash
# Inicie o container PostgreSQL
docker-compose up -d postgres
```

### 2. Inicie o Backend

```bash
# Em um novo terminal
cd backend
npm run dev
```

O backend estará disponível em http://localhost:3001

### 3. Inicie o Frontend

```bash
# Em um novo terminal
npm run dev
```

O frontend estará disponível em http://localhost:3000 (ou outra porta se 3000 estiver em uso)

## Estrutura do Projeto

```
cred30/
├── frontend/                 # Aplicação React
│   ├── components/         # Componentes React
│   ├── services/           # Serviços de API
│   ├── App.tsx            # Componente principal
│   └── index.html          # HTML principal
├── backend/                 # API Hono
│   ├── src/
│   │   ├── middleware/     # Middlewares
│   │   ├── models/         # Models de dados
│   │   ├── routes/         # Rotas da API
│   │   ├── types/          # Tipos TypeScript
│   │   └── utils/          # Utilitários
│   └── package.json
├── docker-compose.yml        # Configuração Docker
└── README.md
```

## Acesso Administrativo

Para acessar o painel administrativo:

1. Crie uma conta normalmente
2. Defina o campo `isAdmin` como `true` no banco de dados
3. Faça login com a conta criada

## Problemas Conhecidos

- **Porta em uso**: Se a porta 3000 ou 3001 estiver em uso, o Vite tentará automaticamente usar outra porta
- **Banco de dados não iniciado**: Certifique-se de que o PostgreSQL está rodando antes de iniciar o backend
- **CORS**: Se encontrar problemas de CORS, verifique as configurações no backend

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a MIT License.
