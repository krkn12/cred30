# Script de Teste de Rotas do Cliente - Cred30

## Descrição

Este script utiliza um token JWT existente para testar todas as rotas disponíveis para clientes no sistema Cred30, verificando funcionamento, validações e respostas da API.

## Funcionalidades

- ✅ **Teste Completo de Rotas**: Verifica todos os endpoints disponíveis para clientes
- ✅ **Autenticação JWT**: Utiliza token real para autenticar requisições
- ✅ **Validações de API**: Testa validações de entrada e regras de negócio
- ✅ **Testes de Segurança**: Verifica proteção contra acesso não autorizado
- ✅ **Relatório Detalhado**: Gera relatório completo com resultados de todos os testes
- ✅ **Logging Estruturado**: Output colorido e organizado para fácil análise

## Pré-requisitos

- Node.js >= 18.0.0
- Servidor backend Cred30 rodando em `http://localhost:3001`
- Token JWT válido (gerado pelo script `test-auth-flow.js`)

## Uso

### Executar Testes Completos

```bash
# Executar todos os testes de rotas
node test-client-routes.js
```

## Estrutura de Testes

O script organiza os testes em categorias:

### 1. Rotas de Usuário (`/api/users`)

| Método | Endpoint              | Descrição                   | Status |
| ------ | --------------------- | --------------------------- | ------ |
| GET    | `/users/profile`      | Obter perfil do usuário     | ✅     |
| GET    | `/users/balance`      | Obter saldo atual           | ✅     |
| GET    | `/users/transactions` | Obter extrato de transações | ✅     |
| PUT    | `/users/profile`      | Atualizar dados do perfil   | ✅     |

### 2. Rotas de Cotas (`/api/quotas`)

| Método | Endpoint           | Descrição                 | Status |
| ------ | ------------------ | ------------------------- | ------ |
| GET    | `/quotas`          | Listar cotas do usuário   | ✅     |
| POST   | `/quotas/buy`      | Solicitar compra de cotas | ✅     |
| POST   | `/quotas/sell`     | Vender cota específica    | ⚠️\*   |
| POST   | `/quotas/sell-all` | Vender todas as cotas     | ⚠️\*   |

\*Testes condicionais dependem de cotas existentes

### 3. Rotas de Empréstimos (`/api/loans`)

| Método | Endpoint         | Descrição                     | Status |
| ------ | ---------------- | ----------------------------- | ------ |
| GET    | `/loans`         | Listar empréstimos do usuário | ✅     |
| POST   | `/loans/request` | Solicitar novo empréstimo     | ✅     |
| POST   | `/loans/repay`   | Pagar empréstimo existente    | ⚠️\*   |

\*Teste de pagamento depende de empréstimo ativo

### 4. Rotas de Transações (`/api/transactions`)

| Método | Endpoint                 | Descrição                    | Status |
| ------ | ------------------------ | ---------------------------- | ------ |
| GET    | `/transactions`          | Listar transações do usuário | ✅     |
| GET    | `/transactions/balance`  | Obter saldo atual            | ✅     |
| POST   | `/transactions/withdraw` | Solicitar saque              | ✅     |

### 5. Testes de Segurança

| Teste            | Descrição                             | Status |
| ---------------- | ------------------------------------- | ------ |
| Acesso sem token | Verifica bloqueio de rota protegida   | ✅     |
| Token inválido   | Verifica rejeição de token malformado | ✅     |

## Exemplos de Execução

### Teste Bem-Sucedido

```bash
$ node test-client-routes.js

=== Teste Completo de Rotas do Cliente ===

[SUCCESS] Token carregado: Usuário Teste 1765573969384 (test1765573969384676@example.com)
[RESULT] Token expira em: 13/12/2025, 18:12:49

[STEP]
=== Testando Rotas de Usuário ===
[INFO] Testando GET /users/profile
[ROUTE] GET /users/profile 200
[SUCCESS] ✓ Perfil do usuário obtido com sucesso
[RESULT] Nome: Usuário Teste 1765573969384
[RESULT] Email: test1765573969384676@example.com
[RESULT] Saldo: R$ 0.00

[INFO] Testando PUT /users/profile
[ROUTE] PUT /users/profile 200
[SUCCESS] ✓ Perfil atualizado com sucesso
[RESULT] Novo nome: Usuário Atualizado 1765574990120

=== Resumo dos Testes ===
Total de testes: 11
Sucessos: 10
Falhas: 1
Taxa de sucesso: 90.9%
```

## Relatório Gerado

O script gera um relatório detalhado em formato JSON:

```json
{
  "timestamp": "2025-12-12T21:29:50.324Z",
  "tokenInfo": {
    "user": {
      "id": 11,
      "name": "Usuário Teste 1765573969384",
      "email": "test1765573969384676@example.com",
      "balance": 0,
      "referralCode": "X3WVD5"
    },
    "expiresAt": "2025-12-13T21:12:49.000Z",
    "isValid": true
  },
  "results": {
    "users": {
      "profile": {
        "success": true,
        "status": 200,
        "data": {
          /* dados do perfil */
        }
      }
    },
    "quotas": {
      "list": {
        "success": true,
        "status": 200,
        "data": {
          /* lista de cotas */
        }
      },
      "buy": {
        "success": true,
        "status": 200,
        "data": {
          /* confirmação da compra */
        }
      }
    }
  },
  "summary": {
    "totalTests": 11,
    "successfulTests": 10,
    "failedTests": 1
  }
}
```

## Cenários Testados

### 1. Autenticação

- ✅ Token válido aceito
- ✅ Token expirado rejeitado
- ✅ Token malformado rejeitado
- ✅ Acesso sem token bloqueado

### 2. Operações de Leitura

- ✅ Leitura de perfil
- ✅ Leitura de saldo
- ✅ Leitura de transações
- ✅ Leitura de cotas
- ✅ Leitura de empréstimos

### 3. Operações de Escrita

- ✅ Atualização de perfil
- ✅ Solicitação de compra de cotas
- ✅ Solicitação de empréstimo
- ✅ Solicitação de saque
- ⚠️ Venda de cotas (depende de cotas existentes)
- ⚠️ Pagamento de empréstimo (depende de empréstimo ativo)

### 4. Validações de Negócio

- ✅ Validação de saldo insuficiente
- ✅ Validação de dados obrigatórios
- ✅ Validação de formatos de dados
- ✅ Limites de valores (máximos e mínimos)

## Interpretação dos Resultados

### Status Codes

| Código | Significado         | Ação                          |
| ------ | ------------------- | ----------------------------- |
| 200    | Sucesso             | ✅ Funcionou corretamente     |
| 201    | Criado              | ✅ Recurso criado com sucesso |
| 400    | Requisição inválida | ⚠️ Erro de validação          |
| 401    | Não autorizado      | ❌ Falha de autenticação      |
| 404    | Não encontrado      | ⚠️ Recurso não existe         |
| 500    | Erro interno        | ❌ Erro no servidor           |

### Indicadores de Qualidade

- **Taxa de Sucesso**: Percentual de testes que passaram
- **Cobertura de Rotas**: Quantidade de endpoints testados
- **Validações**: Quantidade de validações verificadas
- **Segurança**: Testes de proteção contra acessos indevidos

## Troubleshooting

### Problema: "Arquivo auth-tokens.json não encontrado"

**Causa**: Nenhum token foi gerado ainda
**Solução**: Execute primeiro o script de autenticação

```bash
node test-auth-flow.js
```

### Problema: "Token expirado"

**Causa**: O token JWT perdeu a validade
**Solução**: Gere um novo token

```bash
node test-auth-flow.js
```

### Problema: "Falha na requisição"

**Causa**: Backend não está rodando ou inacessível
**Solução**: Verifique se o backend está rodando na porta 3001

```bash
curl http://localhost:3001/api/health
```

## Personalização

### Modificar Endpoints Testados

Edite as funções de teste para adicionar novos endpoints:

```javascript
async function testCustomRoute(token) {
  log.info("Testando rota personalizada");
  const result = await makeRequest("GET", "/custom/endpoint", token);
  if (result.success) {
    log.success("✓ Rota personalizada funcionou");
  }
  return result;
}
```

### Modificar Dados de Teste

Altere os dados de teste nas funções correspondentes:

```javascript
const customData = {
  amount: 200, // Valor personalizado
  installments: 6, // Parcelas personalizadas
  customField: "test",
};
```

## Integração com CI/CD

O script pode ser integrado em pipelines de CI/CD:

```yaml
# Exemplo de GitHub Actions
- name: Test Client Routes
  run: |
    npm run dev &
    sleep 5
    node test-auth-flow.js
    node test-client-routes.js
```

## Contribuição

Para adicionar novos testes:

1. Crie uma função de teste seguindo o padrão existente
2. Adicione a chamada na função principal `runClientRoutesTests()`
3. Atualize a documentação com o novo teste
4. Adicione validações específicas se necessário

## Licença

MIT License - veja o arquivo LICENSE para detalhes.
