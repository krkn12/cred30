# Cred30 - Plataforma Associativa de Apoio Mútuo

Cred30 é uma plataforma de cooperação que permite aportes associativos com distribuição de excedentes operacionais, apoio mútuo entre membros e sistema de indicações.

## 🏗️ Estrutura do Projeto

Este é um monorepo que contém:

- **packages/frontend-v2**: Aplicação React + TypeScript + Vite (PWA)
- **packages/backend**: API Hono + TypeScript + PostgreSQL
- **docs/**: Documentação do projeto
- **scripts/**: Scripts utilitários e de desenvolvimento
- **config/**: Arquivos de configuração compartilhados
- **docker/**: Configurações Docker

## 🚀 Funcionalidades

### Core
- 🏦 **Aportes Associativos**: Participe com cotas a partir de R$ 50,00 e receba excedentes operacionais proporcionais
- 💰 **Apoio Mútuo**: Solicite apoio social com taxa de sustentabilidade de 20%
- 👥 **Reposição de Saldos**: Transfira seus resultados para sua conta via PIX

### Indicação & Benefícios
- 🎁 **Benefício de Boas-Vindas**: Usuários indicados ganham taxas especiais por até 3 usos:
  - Taxa de juros de **3,5%** (ao invés de 20%)
  - Taxa de saque de **R$ 1,00** (50% de desconto)
  - Taxa de marketplace de **2,5%** (50% de desconto)
- ⭐ **Score por Indicação**: Ganhe +50 pontos de Score por cada novo membro ativo

### Marketplace & Economia
- 🛒 **Marketplace Cred30**: Compre e venda produtos com garantia de escrow
- 🚚 **Entrega por Motoboy**: Sistema integrado de entregas
- 💳 **Pagamento via Saldo ou PIX**: Múltiplas formas de pagamento

### Engajamento
- 👑 **Níveis VIP**: Bronze, Prata, Ouro e Fundador
- 📚 **Educação Financeira**: Cursos e conteúdo educacional
- 🗳️ **Governança**: Sistema de votação e propostas
- 🤖 **Assistente IA**: Dicas de gestão e suporte inteligente

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Hono + TypeScript + PostgreSQL + Bun
- **Autenticação**: JWT + 2FA (TOTP)
- **Pagamentos**: Asaas (PIX, Cartão)
- **Hospedagem**: Firebase Hosting (PWA)
- **Banco de Dados**: PostgreSQL (Supabase/Railway)

## 📋 Pré-requisitos

- Node.js 18+
- npm
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
cp packages/backend/.env.example packages/backend/.env
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

### Build e Deploy

```bash
# Build de produção
npm run build

# Deploy completo (bump version + deploy)
npm run release
```

## 📁 Estrutura de Diretórios

```
cred30/
├── packages/
│   ├── frontend-v2/        # PWA React
│   │   ├── src/
│   │   │   ├── presentation/   # Componentes, páginas, views
│   │   │   ├── application/    # Services, hooks
│   │   │   ├── domain/         # Tipos, entidades
│   │   │   └── shared/         # Utilitários, constantes
│   │   └── package.json
│   └── backend/            # API Hono
│       ├── src/
│       │   ├── presentation/   # Routes, middleware
│       │   ├── application/    # Services, use cases
│       │   ├── domain/         # Entities, services
│       │   ├── infrastructure/ # Database, gateways
│       │   └── shared/         # Constants, types
│       └── package.json
├── docs/                   # Documentação
├── scripts/                # Scripts utilitários
└── package.json           # Package.json raiz (monorepo)
```

## 🔐 Acesso Administrativo

Para acessar o painel administrativo:

1. Crie uma conta normalmente
2. No banco de dados, defina `is_admin = true` para o usuário
3. Faça login - será redirecionado automaticamente para `/admin`

## 🌐 URLs de Produção

- **App**: https://cred30-prod-app-2025.web.app
- **API**: Configurada via variáveis de ambiente

## 📊 Constantes de Negócio

| Constante | Valor Normal | Com Benefício |
|-----------|--------------|---------------|
| Taxa de Juros | 20% | 3,5% |
| Taxa de Originação | 3% | 1,5% |
| Taxa de Saque | R$ 2,00 | R$ 1,00 |
| Taxa Marketplace | 5% | 2,5% |
| Usos do Benefício | - | 3 usos |

## 🐛 Problemas Conhecidos

- **Porta em uso**: O Vite tentará automaticamente usar outra porta
- **Banco não iniciado**: Verifique se o PostgreSQL está acessível
- **PWA obrigatório**: Usuários precisam instalar o app para acessar

## 📄 Licença

Este projeto está licenciado sob a MIT License.