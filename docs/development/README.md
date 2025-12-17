# Estrutura do Frontend - Cred30

Este documento descreve a estrutura organizada do frontend do projeto Cred30.

## 📁 Estrutura de Pastas

```
src/
├── components/           # Componentes React reutilizáveis
│   ├── admin/           # Componentes específicos do painel administrativo
│   │   ├── MetricCard.tsx
│   │   ├── PendingItemsTable.tsx
│   │   └── FinancialDashboard.tsx
│   ├── client/          # Componentes específicos do painel do cliente
│   │   └── ClientDashboard.tsx
│   ├── ui/              # Componentes UI genéricos
│   │   └── Modal.tsx
│   └── index.ts         # Exportações centralizadas
├── utils/               # Utilitários e funções auxiliares
│   ├── formatters.ts     # Formatação de valores, datas, etc.
│   └── constants.ts     # Constantes da aplicação
└── services/            # Serviços de API e armazenamento
    ├── apiService.ts
    ├── apiStorageService.ts
    └── storageService.ts
```

## 🧩 Componentes

### Componentes Administrativos

#### `MetricCard`

Componente reutilizável para exibir métricas financeiras com diferentes cores e tamanhos.

```tsx
<MetricCard
  title="Caixa Operacional"
  value={formatCurrency(systemBalance)}
  subtitle="Capital de giro disponível"
  color="blue"
/>
```

#### `PendingItemsTable`

Tabela para exibir itens pendentes (transações ou empréstimos) com ações de aprovação/rejeição.

```tsx
<PendingItemsTable
  title="Transações Pendentes"
  items={pendingTransactions}
  onApprove={handleApprove}
  onReject={handleReject}
  type="transactions"
/>
```

#### `FinancialDashboard`

Dashboard financeiro completo com métricas, gestão de lucros e controles administrativos.

```tsx
<FinancialDashboard
  systemBalance={systemBalance}
  profitPool={profitPool}
  quotasCount={quotasCount}
  onUpdateBalance={handleUpdateBalance}
  onAddProfit={handleAddProfit}
  onDistributeProfits={handleDistributeProfits}
/>
```

### Componentes do Cliente

#### `ClientDashboard`

Dashboard completo para o cliente com resumo financeiro, ações rápidas e visualização de investimentos.

```tsx
<ClientDashboard
  user={currentUser}
  quotas={userQuotas}
  loans={userLoans}
  onDeposit={handleDeposit}
  onWithdraw={handleWithdraw}
  onBuyQuota={handleBuyQuota}
  onSellQuota={handleSellQuota}
  onRequestLoan={handleRequestLoan}
/>
```

### Componentes UI

#### `Modal`

Modal genérico reutilizável com diferentes tamanhos.

```tsx
<Modal
  isOpen={isModalOpen}
  onClose={handleClose}
  title="Título do Modal"
  size="md"
>
  <Conteúdo do modal />
</Modal>
```

#### `ConfirmModal`

Modal de confirmação com diferentes tipos (danger, warning, info).

```tsx
<ConfirmModal
  isOpen={showConfirm}
  onClose={handleCancel}
  onConfirm={handleConfirm}
  title="Confirmar Ação"
  message="Tem certeza que deseja continuar?"
  type="danger"
/>
```

## 🛠️ Utilitários

### Formatters (`utils/formatters.ts`)

Funções de formatação padronizadas:

- `formatCurrency(value: number)` - Formata valores monetários em BRL
- `formatDateTime(timestamp: number)` - Formata data e hora em pt-BR
- `formatDate(timestamp: number)` - Formata apenas a data
- `formatPercent(value: number)` - Formata valores percentuais

### Constants (`utils/constants.ts`)

Constantes centralizadas da aplicação:

- `API_BASE_URL` - URL base da API
- `CACHE_DURATION` - Durações de cache
- `TRANSACTION_TYPES` - Tipos de transação
- `LOAN_STATUS` - Status de empréstimos
- `FINANCIAL_CONSTANTS` - Constantes financeiras
- `STATUS_COLORS` - Cores para status
- `STATUS_BADGES` - Classes CSS para badges de status

## 🎨 Guia de Estilos

### Cores

- **Azul**: Caixa operacional, informações gerais
- **Verde**: Lucros, valores positivos, status aprovado
- **Amarelo**: Alertas, status pendente
- **Vermelho**: Prejuízos, dívidas, status rejeitado
- **Roxo**: Empréstimos, ações financeiras
- **Indigo**: Relatórios, informações secundárias

### Responsividade

- **Mobile**: Layout de uma coluna
- **Tablet**: Layout de duas colunas
- **Desktop**: Layout de 3-4 colunas para métricas

## 🔄 Padrões de Código

### Nomenclatura

- Componentes: PascalCase
- Funções: camelCase
- Constantes: UPPER_SNAKE_CASE
- Arquivos: kebab-case para pastas, PascalCase para componentes

### Estrutura de Componente

```tsx
import React from 'react';
import { formatCurrency } from '../../utils/formatters';

interface ComponentProps {
  // Props tipadas
}

export const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Lógica do componente

  return (
    // JSX com classes Tailwind
  );
};
```

### Imports

```tsx
// React sempre primeiro
import React from "react";

// Componentes locais
import { Component } from "./Component";

// Utilitários
import { formatCurrency } from "../../utils/formatters";
import { CONSTANTS } from "../../utils/constants";

// Tipos
import { Type } from "../../../types";
```

## 📱 Melhorias Implementadas

1. **Organização de Componentes**: Separação clara entre componentes admin, client e UI
2. **Utilitários Centralizados**: Formatação e constantes em arquivos dedicados
3. **TypeScript**: Tipagem completa para todos os componentes
4. **Acessibilidade**: Atributos title e aria-label onde necessário
5. **Responsividade**: Design adaptativo para diferentes tamanhos de tela
6. **Performance**: Otimização de renders e cache de dados
7. **Manutenibilidade**: Código modular e documentado

## 🚀 Próximos Passos

- [ ] Implementar testes unitários para componentes
- [ ] Adicionar Storybook para documentação visual
- [ ] Otimizar carregamento com lazy loading
- [ ] Implementar internacionalização (i18n)
- [ ] Adicionar temas customizáveis
