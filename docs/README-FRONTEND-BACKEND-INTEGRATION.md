# Script de Integração Frontend-Backend

Este script simula as interações do frontend com o backend utilizando as mesmas estruturas de dados e chamadas de API que o frontend real utiliza.

## 🎯 Objetivo

O script `test-frontend-backend-integration.js` foi desenvolvido para testar a comunicação entre o frontend e o backend do sistema Cred30, garantindo que os dados enviados pelo frontend sejam processados corretamente pelo backend.

## 📁 Baseado nos Arquivos do Frontend

O script replica exatamente a lógica dos seguintes arquivos do frontend:

- `services/apiService.ts` - Classe de comunicação com a API
- `services/apiStorageService.ts` - Funções de conversão e gerenciamento de estado
- `types.ts` - Interfaces e tipos de dados
- `constants.ts` - Constantes do sistema

## 🚀 Funcionalidades

### 1. **Autenticação**

- Registro de novos usuários
- Login com credenciais existentes
- Reset de senha
- Gerenciamento de tokens JWT

### 2. **Operações do Usuário**

- Compra de cotas (via PIX ou saldo)
- Venda de cotas individuais
- Venda de todas as cotas
- Solicitação de empréstimos
- Pagamento de empréstimos
- Solicitação de saques

### 3. **Consultas de Dados**

- Obter perfil do usuário
- Consultar saldo
- Listar transações
- Listar cotas
- Listar empréstimos

### 4. **Funções Administrativas**

- Obter dashboard administrativo
- Atualizar caixa operacional
- Adicionar lucro ao pool
- Processar ações (aprovar/rejeitar)
- Distribuir dividendos

## 📋 Estrutura dos Dados

O script utiliza as mesmas estruturas de dados do frontend:

### User

```javascript
{
  id: string,
  name: string,
  email: string,
  secretPhrase: string,
  pixKey: string,
  balance: number,
  joinedAt: number,
  referralCode: string,
  isAdmin?: boolean
}
```

### Quota

```javascript
{
  id: string,
  userId: string,
  purchasePrice: number,
  purchaseDate: number,
  currentValue: number,
  yieldRate: number
}
```

### Loan

```javascript
{
  id: string,
  userId: string,
  amount: number,
  totalRepayment: number,
  installments: number,
  interestRate: number,
  requestDate: number,
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'DEFAULTED' | 'REJECTED' | 'PAYMENT_PENDING',
  pixKeyToReceive: string,
  dueDate: number
}
```

### Transaction

```javascript
{
  id: string,
  userId: string,
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BUY_QUOTA' | 'SELL_QUOTA' | 'LOAN_RECEIVED' | 'LOAN_PAYMENT' | 'REFERRAL_BONUS',
  amount: number,
  date: number,
  description: string,
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  metadata?: any
}
```

## 🛠️ Como Usar

### Pré-requisitos

- Node.js instalado
- Backend do Cred30 rodando em `http://localhost:3001`
- Dependências instaladas (`npm install`)

### Instalação de Dependências

```bash
npm install
```

### Executar Testes Completos

```bash
node test-frontend-backend-integration.js
```

### Executar Fluxos Específicos

#### Fluxo Completo do Usuário

```bash
node test-frontend-backend-integration.js complete-user-flow
```

#### Fluxo Administrativo

```bash
node test-frontend-backend-integration.js admin-flow
```

#### Fluxo de Investimento

```bash
node test-frontend-backend-integration.js investment-flow
```

#### Fluxo de Empréstimo

```bash
node test-frontend-backend-integration.js loan-flow
```

## 📊 Relatórios Gerados

O script gera relatórios detalhados em formato JSON:

- `frontend-backend-integration-report-{timestamp}.json` - Relatório completo dos testes
- `auth-tokens.json` - Tokens de autenticação armazenados

### Estrutura do Relatório

```json
{
  "timestamp": "2025-12-12T21:35:36.676Z",
  "tests": [
    {
      "name": "Registro de Usuário",
      "status": "PASSED",
      "result": { ... },
      "timestamp": "2025-12-12T21:35:37.123Z"
    }
  ],
  "summary": {
    "total": 15,
    "passed": 14,
    "failed": 1
  }
}
```

## 🔧 Configuração

### Variáveis de Ambiente

- `API_URL` - URL da API (padrão: `http://localhost:3001/api`)

### Constantes do Sistema

```javascript
const QUOTA_PRICE = 50.0;
const LOAN_INTEREST_RATE = 0.2; // 20% ao mês
const PENALTY_RATE = 0.4; // 40% de multa
const ADMIN_PIX_KEY = "91980177874";
```

## 📝 Logs e Saída

O script utiliza logs coloridos e estruturados:

- 🔵 **[INFO]** - Informações gerais
- 🟢 **[SUCCESS]** - Operações bem-sucedidas
- 🟡 **[WARNING]** - Avisos
- 🔴 **[ERROR]** - Erros

### Exemplo de Saída

```
[INFO] Iniciando teste de integração Frontend-Backend
[INFO] Executando teste: Registro de Usuário
[SUCCESS] ✅ Registro de Usuário
[INFO] Executando teste: Carregar Estado do Usuário
[SUCCESS] ✅ Carregar Estado do Usuário

=== RESUMO DOS TESTES ===
Total: 15
Passaram: 14
Falharam: 1
Taxa de sucesso: 93.3%
```

## 🧪 Testes Automatizados

O script executa automaticamente os seguintes testes:

1. **Registro de Usuário** - Cria um novo usuário com dados aleatórios
2. **Carregar Estado** - Obtém o estado completo do usuário
3. **Obter Perfil** - Consulta informações do perfil
4. **Obter Saldo** - Verifica saldo disponível
5. **Comprar Cota** - Realiza compra de cota (PIX ou saldo)
6. **Obter Cotas** - Lista cotas do usuário
7. **Solicitar Empréstimo** - Cria solicitação de empréstimo
8. **Obter Empréstimos** - Lista empréstimos do usuário
9. **Obter Transações** - Lista histórico de transações
10. **Solicitar Saque** - Realiza solicitação de saque
11. **Vender Cota** - Vende cota existente
12. **Login** - Testa login com usuário existente
13. **Dashboard Admin** - Obtém painel administrativo (se admin)
14. **Atualizar Caixa** - Atualiza caixa operacional (se admin)
15. **Adicionar Lucro** - Adiciona lucro ao pool (se admin)

## 🔍 Validações Realizadas

### Validação de Dados

- Verificação de formatos de email
- Validação de valores monetários
- Verificação de chaves PIX
- Validação de frases secretas

### Validação de Negócio

- Saldo suficiente para operações
- Limite de cotas por usuário
- Validação de prazos de carência
- Verificação de limites de empréstimo

### Validação de Segurança

- Autenticação via token JWT
- Verificação de permissões administrativas
- Proteção contra acesso não autorizado
- Validação de CORS

## 🚨 Tratamento de Erros

O script possui tratamento robusto de erros:

- **Erros de Rede** - Tentativas de reconexão
- **Erros de API** - Mensagens detalhadas do backend
- **Erros de Validação** - Indicação de campos inválidos
- **Erros de Autenticação** - Redirecionamento para login

## 🔄 Fluxos de Teste

### Fluxo Completo do Usuário

1. Registrar novo usuário
2. Comprar cota
3. Solicitar empréstimo
4. Verificar estado final

### Fluxo Administrativo

1. Login como admin
2. Obter dashboard
3. Atualizar caixa
4. Adicionar lucro
5. Processar itens pendentes

### Fluxo de Investimento

1. Registrar usuário
2. Comprar múltiplas cotas
3. Vender uma cota
4. Verificar resultados

### Fluxo de Empréstimo

1. Registrar usuário
2. Solicitar empréstimo
3. Pagar empréstimo
4. Verificar status

## 📈 Métricas e Indicadores

O script coleta as seguintes métricas:

- **Taxa de Sucesso** - Percentual de testes passados
- **Tempo de Resposta** - Duração de cada requisição
- **Volume de Dados** - Quantidade de dados processados
- **Erros por Tipo** - Classificação dos erros

## 🛡️ Segurança

### Armazenamento de Tokens

- Tokens salvos em `auth-tokens.json`
- Criptografia de dados sensíveis
- Expiração automática de tokens

### Validação de Entrada

- Sanitização de dados de entrada
- Verificação de formatos válidos
- Prevenção contra injeção de código

## 🔧 Personalização

### Adicionar Novos Testes

```javascript
const runTest = async (testName, testFunction) => {
  // Implementação do teste
};

// Exemplo de novo teste
await runTest("Meu Novo Teste", async () => {
  return await api.minhaNovaFuncao(parametros);
});
```

### Modificar Constantes

```javascript
const QUOTA_PRICE = 100.0; // Novo valor da cota
const LOAN_INTEREST_RATE = 0.15; // Nova taxa de juros
```

## 📝 Considerações Finais

Este script é uma ferramenta essencial para:

- ✅ Validar a comunicação frontend-backend
- ✅ Testar fluxos de negócio completos
- ✅ Identificar problemas de integração
- ✅ Garantir qualidade do software
- ✅ Automatizar testes de regressão

Ele replica exatamente o comportamento do frontend real, garantindo que os dados enviados sejam processados corretamente pelo backend.

## 🆘 Suporte

Caso encontre problemas:

1. Verifique se o backend está rodando
2. Confirme a URL da API
3. Verifique as credenciais de admin
4. Analise os logs de erro
5. Consulte os relatórios gerados

Para mais informações, consulte a documentação do backend e do frontend do projeto Cred30.
