# Como Resolver os 4 Pontos de Atenção

---

## 1. 🎰 Sistema de Apostas (Risco Legal)

**Problema:** Jogos de azar online são ilegais no Brasil.

**Solução simples:**

- Remover o tipo de transação `GAME_BET`
- Não tem uso no sistema atual (verificado no código)

**Arquivo:** `packages/backend/src/shared/types/Transaction.type.ts`

**O que fazer:**

```typescript
// Remover GAME_BET da lista de tipos
type: "DEPOSIT" |
  "WITHDRAWAL" |
  "PROFIT_DISTRIBUTION" |
  "QUOTA_PURCHASE" |
  "QUOTA_LIQUIDATION" |
  "MAINTENANCE_FEE";
// REMOVER: | 'GAME_BET'
```

---

## 2. 💰 Taxa Marketplace 27,5% (Alta)

**Problema:** Vendedores vão para outras plataformas (Mercado Livre: 5-15%).

**Solução simples:**

- Reduzir taxa de não verificados de 27,5% para 12%

**Arquivo:** `packages/backend/src/shared/constants/business.constants.ts`

**O que fazer:**

```typescript
// Linha 52
// De:
export const MARKETPLACE_NON_VERIFIED_FEE_RATE = 0.275; // 27.5%

// Para:
export const MARKETPLACE_NON_VERIFIED_FEE_RATE = 0.12; // 12%
```

**Impacto:** Menos receita por venda, mas mais vendas (concorrente com Mercado Livre)

---

## 3. ⚠️ Multa 0,5%/dia (180% ao ano - Abusivo)

**Problema:** Artigo 406 do CC limita multa em 2% máximo.

**Solução simples:**

- Mudar de 0,5%/dia para 0,066%/dia (2% ao mês)

**Arquivo:** `packages/backend/src/shared/constants/business.constants.ts`

**O que fazer:**

```typescript
// Linha 29
// De:
export const DAILY_LATE_FEE = 0.005; // 0.5% ao dia

// Para:
export const DAILY_LATE_FEE = 0.00066; // ~0.066% ao dia = 2% ao mês
export const MAX_LATE_PENALTY = 0.02; // Limite máximo de 2%
```

---

## 4. 🏦 Empréstimos sem Lastro Real

**Problema:** Sistema empresta dinheiro que não tem em caixa.

**Solução simples:**

- Criar verificação de liquidez antes de aprovar empréstimo

**Arquivo:** `packages/backend/src/domain/services/transaction.service.ts`

**O que fazer:**

```typescript
// Antes de aprovar empréstimo, verificar:

const configRes = await pool.query(
  "SELECT system_balance FROM system_config LIMIT 1"
);
const caixa = parseFloat(configRes.rows[0].system_balance);

const valorEmprestimo = 1000;
const maximoPermitido = caixa * 0.5; // Só emprestar 50% do caixa

if (valorEmprestimo > maximoPermitido) {
  throw new Error(
    "Empréstimo temporariamente indisponível. Tente um valor menor."
  );
}
```

**Simples assim:** Se o caixa tem R$ 10.000, só pode emprender R$ 5.000.

---

## 📋 Resumo das 4 Correções

| #   | Problema        | Solução               | Arquivo                |
| --- | --------------- | --------------------- | ---------------------- |
| 1   | Apostas ilegais | Remover GAME_BET      | Transaction.type.ts    |
| 2   | Taxa 27,5% alta | Mudar para 12%        | business.constants.ts  |
| 3   | Multa abusiva   | 0,066%/dia (2%/mês)   | business.constants.ts  |
| 4   | Sem lastro      | Verificar caixa antes | transaction.service.ts |

---

## ⏱️ Tempo de Correção

- 1 e 2: 5 minutos cada (só mudar número)
- 3: 5 minutos
- 4: 30 minutos (adicionar verificação)

**Total: aproximadamente 1 hora de trabalho**

---

## ⚠️ Depois de corrigir

Testar no ambiente de desenvolvimento antes de colocar em produção.
