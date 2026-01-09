# Cred30 - Plataforma de Crédito Colaborativo

## O que é?

O Cred30 é uma plataforma onde pessoas podem:

- **Investir em cotas** e receber lucros
- **Pegar emprestado** de outros membros
- **Vender/comprar** no marketplace local
- **Ganhar entregando** produtos

---

## Status Atual

✅ Sistema funcionando
✅ Banco de dados PostgreSQL (Neon)
✅ API com Hono + TypeScript + Bun
✅ Frontend em React
✅ PIX manual funcionando

---

## Principais Funcionalidades

### 1. Cotas de Investimento

- Preço: R$ 50,00 por cota
- Rendimentos distribuídos mensalmente
- Penalidade de 40% para saída antecipada

### 2. Empréstimos (Apoio Mútuo)

- Taxa de juros: 20%
- Parcelamento em até 12x
- Score avalia limite de crédito

### 3. Marketplace

- Taxa de 12% (vendedores verificados)
- Taxa de 27,5% (vendedores não verificados)
- Sistema de entrega local (Belém)

### 4. Logística

- Entregadores ganham 90% do frete
- 10% para taxa de sustentabilidade

---

## Tecnologias

- **Backend:** Hono + TypeScript + Bun
- **Banco:** PostgreSQL (Neon)
- **Auth:** JWT + Firebase
- **Pagamentos:** PIX Manual + Mercado Pago
- **IA:** Google Gemini

---

## Como rodar

```bash
cd packages/backend
bun install
bun run dev
```

---

## Contato

Josias Silva - josiassm701@gmail.com
