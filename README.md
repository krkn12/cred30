# Cred30 - Plataforma Associativa de Apoio Mútuo

Cred30 é uma plataforma de cooperação que permite aportes associativos com distribuição de excedentes operacionais, apoio mútuo entre membros e sistema de indicações.

## 🏗️ Estrutura do Projeto

Este é um monorepo que contém:

- **packages/frontend**: Aplicação React + TypeScript + Vite
- **packages/backend**: API Hono + TypeScript + PostgreSQL
- **docs/**: Documentação do projeto
- **scripts/**: Scripts utilitários e de desenvolvimento
- **config/**: Arquivos de configuração compartilhados
- **docker/**: Configurações Docker
- **tools/**: Ferramentas de desenvolvimento (ESLint, Prettier, TypeScript)

## 🚀 Funcionalidades

- 🏦 **Aportes Associativos**: Participe com cotas a partir de R$ 50,00 e receba excedentes operacionais proporcionais
- 💰 **Apoio Mútuo**: Solicite apoio social com taxa de sustentabilidade de 20%
- 👥 **Reposição de Saldos**: Transfira seus resultados para sua conta via PIX
- 🎯 **Sistema de Indicação**: Bônus de R$ 5,00 por cada novo membro indicado
- 👑 **Níveis VIP**: Benefícios exclusivos para membros engajados
- 🤖 **Assistente IA**: Dicas de gestão e educação cooperativa

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Hono + TypeScript + PostgreSQL + Bun
- **Autenticação**: JWT
- **Estilo**: Dark mode com design moderno
- **Infraestrutura**: Docker + Docker Compose

## 📋 Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- npm ou yarn
- Bun (para o backend)

## 🔧 Configuração do Ambiente

1. Clone o repositório:

```bash
git clone <url-do-repositorio>
cd cred30
```

2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente:

```bash
cp config/.env.example config/.env
```

4. Inicie o banco de dados:

```bash
npm run docker:up
```

## 🏃‍♂️ Executando o Projeto

### Desenvolvimento

```bash
# Iniciar frontend e backend simultaneamente
npm run dev

# Apenas backend
npm run dev:backend

# Apenas frontend
npm run dev:frontend
```

### Build

```bash
# Build de todos os pacotes
npm run build

# Build específico
npm run build:backend
npm run build:frontend
```

### Testes

```bash
# Executar todos os testes
npm run test

# Testes específicos
npm run test:backend
npm run test:frontend
```

### Lint e Formatação

```bash
# Lint de todos os pacotes
npm run lint

# Formatar código
npm run format
```

## 📁 Estrutura de Diretórios

```
cred30/
├── packages/
│   ├── frontend/           # Aplicação React
│   │   ├── src/
│   │   │   ├── presentation/   # Componentes React, páginas
│   │   │   ├── application/    # Services, stores, mappers
│   │   │   ├── domain/         # Entidades, tipos de domínio
│   │   │   ├── infrastructure/ # Implementações de infraestrutura
│   │   │   └── shared/         # Utilitários compartilhados
│   │   ├── tests/
│   │   └── package.json
│   └── backend/            # API Hono
│       ├── src/
│       │   ├── presentation/   # Controllers, routes, middleware
│       │   ├── application/    # Use cases, DTOs, validators
│       │   ├── domain/         # Entidades, repositórios, serviços
│       │   ├── infrastructure/ # Banco de dados, cache, logging
│       │   └── shared/         # Utilitários compartilhados
│       ├── tests/
│       └── package.json
├── docs/                   # Documentação
│   ├── api/                # Documentação da API
│   ├── deployment/         # Guias de deploy
│   └── development/        # Guias de desenvolvimento
├── scripts/                # Scripts utilitários
│   ├── database/           # Scripts de banco de dados
│   ├── deployment/         # Scripts de deploy
│   └── development/        # Scripts de desenvolvimento
├── config/                 # Configurações compartilhadas
├── docker/                 # Arquivos Docker
├── tools/                  # Ferramentas de desenvolvimento
│   ├── eslint/             # Configurações ESLint
│   ├── prettier/           # Configurações Prettier
│   └── typescript/         # Configurações TypeScript
└── package.json           # Package.json raiz (monorepo)
```

## 🔐 Acesso Administrativo

Para acessar o painel administrativo:

1. Crie uma conta normalmente
2. Defina o campo `isAdmin` como `true` no banco de dados
3. Faça login com a conta criada

## 🐛 Problemas Conhecidos

- **Porta em uso**: Se a porta 3000 ou 3001 estiver em uso, o Vite tentará automaticamente usar outra porta
- **Banco de dados não iniciado**: Certifique-se de que o PostgreSQL está rodando antes de iniciar o backend
- **CORS**: Se encontrar problemas de CORS, verifique as configurações no backend

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License.