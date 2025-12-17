# Lógica do Desenvolvimento Frontend: Arquitetura e Melhores Práticas

## Índice

1. [Arquitetura do Lado do Cliente](#arquitetura-do-lado-do-cliente)
2. [Processamento de Dados](#processamento-de-dados)
3. [Interação com APIs](#interação-com-apis)
4. [Gerenciamento de Estado](#gerenciamento-de-estado)
5. [Renderização de Componentes](#renderização-de-componentes)
6. [Organização do Código JavaScript/TypeScript](#organização-do-código-javascripttypescript)
7. [Fluxo de Dados do Backend para a UI](#fluxo-de-dados-do-backend-para-a-ui)
8. [Processamento de Respostas Assíncronas](#processamento-de-respostas-assíncronas)

---

## Arquitetura do Lado do Cliente

### Estrutura Fundamental

O frontend deste projeto segue uma arquitetura de componentes com React, utilizando TypeScript para tipagem forte. A estrutura é organizada da seguinte forma:

```
src/
├── App.tsx              # Componente principal e roteamento
├── components/          # Componentes reutilizáveis
│   ├── Layout.tsx      # Layout principal da aplicação
│   └── AIAssistant.tsx # Componente de assistente IA
├── services/           # Camada de serviço para API
│   ├── apiService.ts   # Cliente HTTP para comunicação com backend
│   └── apiStorageService.ts # Serviço híbrido (API + Storage local)
├── types.ts            # Definições de tipos TypeScript
└── constants.ts        # Constantes da aplicação
```

### Padrão Arquitetural

A aplicação implementa uma variação do padrão **MVVM (Model-View-ViewModel)**:

- **Model**: Definido em [`types.ts`](types.ts:1) com interfaces como `User`, `Quota`, `Loan`, `Transaction` e `AppState`
- **View**: Componentes React que renderizam a interface
- **ViewModel**: Lógica de negócio nos componentes e serviços, gerenciando o estado e as interações

### Componente Principal

O [`App.tsx`](App.tsx:1084) funciona como o componente raiz que gerencia:

- Estado global da aplicação através do hook `useState`
- Autenticação e controle de acesso
- Navegação entre diferentes visualizações
- Integração com serviços de API

```typescript
const [state, setState] = useState<AppState>({
  currentUser: null,
  users: [],
  quotas: [],
  loans: [],
  transactions: [],
  systemBalance: 0,
  profitPool: 0,
});
```

---

## Processamento de Dados

### Transformação de Dados

O frontend processa dados brutos da API para formatos adequados à interface:

```typescript
// Exemplo de formatação de moeda em App.tsx
const formatCurrency = (val: number) => {
  if (typeof val !== "number" || isNaN(val)) {
    return "R$ 0,00";
  }
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
```

### Validação e Sanitização

Antes de enviar dados ao backend, o frontend realiza validações:

```typescript
// Validação de entrada monetária em AdminDashboard
const parseCurrencyInput = (val: string) => {
  const clean = val.replace(/[^0-9,.]/g, "");
  const standard = clean.replace(",", ".");
  return parseFloat(standard);
};
```

### Cálculos no Cliente

O frontend realiza cálculos locais para feedback imediato:

```typescript
// Cálculo de empréstimo em LoansView
const interestRate = 0.2; // 20%
const total = amount
  ? parseFloat(amount) * (1 + interestRate * installments)
  : 0;
```

---

## Interação com APIs

### Cliente HTTP Centralizado

O [`apiService.ts`](services/apiService.ts:27) implementa uma classe singleton para centralizar todas as comunicações HTTP:

```typescript
class ApiService {
  private token: string | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: this.getHeaders(),
      ...options,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erro na requisição");
    }

    return data;
  }
}
```

### Autenticação JWT

O sistema implementa autenticação baseada em tokens JWT:

```typescript
// Armazenamento e envio de token
private getHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (this.token) {
    headers['Authorization'] = `Bearer ${this.token}`;
  }

  return headers;
}
```

### Tratamento de Erros

O serviço implementa tratamento robusto de erros:

```typescript
try {
  const response = await this.request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, secretPhrase }),
  });

  this.token = response.data?.token || null;
  if (this.token) {
    localStorage.setItem("authToken", this.token);
  }

  return response.data!;
} catch (error) {
  console.error("Erro na requisição:", error);
  throw error;
}
```

---

## Gerenciamento de Estado

### Estado Local com useState

O estado local é gerenciado principalmente com o hook `useState`:

```typescript
const [currentView, setCurrentView] = useState("dashboard");
const [adminMode, setAdminMode] = useState(false);
const [isLoading, setIsLoading] = useState(true);
```

### Estado Global Centralizado

O estado global é mantido no componente principal `App`:

```typescript
const [state, setState] = useState<AppState>({
  currentUser: null,
  users: [],
  quotas: [],
  loans: [],
  transactions: [],
  systemBalance: 0,
  profitPool: 0,
});
```

### Sincronização com Backend

A função `refreshState` sincroniza o estado local com o backend:

```typescript
const refreshState = async () => {
  try {
    const newState = await loadState();
    setState(newState);
  } catch (error) {
    console.error("Erro ao atualizar estado:", error);
  }
};
```

### Padrão Observer com useEffect

O hook `useEffect` é usado para reagir a mudanças de estado:

```typescript
useEffect(() => {
  const fetchPending = async () => {
    try {
      setIsLoading(true);
      const result = await getPendingItems();
      setPending(result);
    } catch (error) {
      console.error("Erro ao carregar itens pendentes:", error);
    } finally {
      setIsLoading(false);
    }
  };
  fetchPending();
}, [state]);
```

---

## Renderização de Componentes

### Componentes Funcionais

Todos os componentes são implementados como funções React:

```typescript
const Dashboard = ({
  state,
  onBuyQuota,
  onReinvest,
  onRefer,
  onVip,
  onLogout,
}: {
  state: AppState;
  onBuyQuota: () => void;
  onReinvest: () => void;
  onRefer: () => void;
  onVip: () => void;
  onLogout: () => void;
}) => {
  // Lógica do componente
  return <div className="space-y-6">{/* JSX do componente */}</div>;
};
```

### Renderização Condicional

A aplicação utiliza renderização condicional para diferentes estados:

```typescript
if (isLoading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
    </div>
  );
}

if (!state.currentUser) {
  return <AuthScreen onLogin={handleLogin} />;
}

if (
  state.currentUser.isAdmin ||
  adminMode ||
  state.currentUser.email === "josiassm701@gmail.com"
) {
  return (
    <div className="min-h-screen bg-background p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <AdminDashboard
          state={state}
          onRefresh={refreshState}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}
```

### Componentes de Apresentação vs. Contêiner

O projeto separa componentes de apresentação (focus na UI) de contêiner (focus na lógica):

- **Layout.tsx**: Componente de apresentação focado na estrutura visual
- **App.tsx**: Componente contêiner que gerencia estado e lógica

---

## Organização do Código JavaScript/TypeScript

### Estrutura de Pastas Lógica

A organização segue princípios de separação de responsabilidades:

```
src/
├── components/         # Componentes de UI reutilizáveis
├── services/          # Lógica de negócio e comunicação com APIs
├── types.ts           # Tipos compartilhados
├── constants.ts       # Constantes da aplicação
└── App.tsx           # Componente principal e roteamento
```

### Padrão de Nomenclatura

- **Componentes**: PascalCase (`Dashboard`, `AdminDashboard`)
- **Funções**: camelCase (`handleLogin`, `refreshState`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`, `QUOTA_PRICE`)
- **Arquivos**: kebab-case para componentes (`ai-assistant.tsx`) ou PascalCase para principais (`App.tsx`)

### Modularização

O código é modularizado para facilitar manutenção:

```typescript
// Exportação de serviço singleton
export const apiService = new ApiService();

// Importação em componentes
import { apiService } from "./services/apiService";
```

### Tipagem Forte

TypeScript é usado para garantir segurança de tipos:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    pixKey: string;
    balance: number;
    joinedAt: number;
    referralCode: string;
    isAdmin?: boolean;
  };
  token: string;
}
```

---

## Fluxo de Dados do Backend para a UI

### Ciclo de Vida dos Dados

1. **Inicialização**: O componente `App` carrega o estado inicial via `loadState()`
2. **Atualização**: Ações do usuário disparam chamadas à API
3. **Processamento**: Respostas são processadas e o estado é atualizado
4. **Renderização**: React re-renderiza componentes com os novos dados

### Exemplo Prático: Login de Usuário

```typescript
// 1. Usuário preenche formulário e clica em "Entrar"
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const user = loginUser(email, password, secretPhrase);
    user.then((u) => onLogin(u));
  } catch (error: any) {
    alert(error.message);
  }
};

// 2. Função de login chama serviço
const handleLogin = async (user: User) => {
  const newState = await loadState();
  setState(newState);

  // 3. Verificação de permissões
  const isAdminUser = user.email === "josiassm701@gmail.com" || user.isAdmin;

  if (isAdminUser) {
    setAdminMode(true);
  } else {
    setCurrentView("dashboard");
  }
};
```

### Exemplo Prático: Compra de Cotas

```typescript
// 1. Usuário seleciona quantidade e método de pagamento
const handleBuyQuota = async (qty: number, method: "PIX" | "BALANCE") => {
  try {
    // 2. Chamada à API para processar compra
    await buyQuota(qty, method === "BALANCE");

    // 3. Atualização do estado local
    await refreshState();

    // 4. Feedback ao usuário
    alert(
      `Solicitação de compra enviada! Aguarde a aprovação do administrador.`
    );
    setCurrentView("dashboard");
  } catch (e: any) {
    alert(e.message);
  }
};
```

### Fluxo de Dados em Gráfico

```
[Interface do Usuário] → [Evento] → [Função Handler] → [Serviço API]
       ↓                                                      ↓
[Renderização] ← [Atualização de Estado] ← [Resposta da API] ← [Backend]
```

---

## Processamento de Respostas Assíncronas

### Padrão Async/Await

O projeto utiliza async/await para lidar com operações assíncronas:

```typescript
const fetchPending = async () => {
  try {
    setIsLoading(true);
    const result = await getPendingItems();
    setPending(result);
  } catch (error) {
    console.error("Erro ao carregar itens pendentes:", error);
  } finally {
    setIsLoading(false);
  }
};
```

### Estados de Carregamento

O gerenciamento de estados de carregamento melhora a UX:

```typescript
const [isLoading, setIsLoading] = useState(true);

if (isLoading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
    </div>
  );
}
```

### Tratamento de Erros

Erros são capturados e apresentados ao usuário:

```typescript
try {
  await buyQuota(qty, method === "BALANCE");
  await refreshState();
  alert(`Solicitação de compra enviada! Aguarde a aprovação do administrador.`);
  setCurrentView("dashboard");
} catch (e: any) {
  alert(e.message);
}
```

### Otimização com useCallback

Hooks como `useCallback` são usados para otimizar renderizações:

```typescript
const handleLogin = useCallback(async (user: User) => {
  const newState = await loadState();
  setState(newState);

  const isAdminUser = user.email === "josiassm701@gmail.com" || user.isAdmin;

  if (isAdminUser) {
    setAdminMode(true);
  } else {
    setCurrentView("dashboard");
  }
}, []);
```

### Paralelização de Requisições

Quando possível, múltiplas requisições são executadas em paralelo:

```typescript
// Carregamento inicial de dados
useEffect(() => {
  const loadInitialState = async () => {
    try {
      const [initialState, userProfile] = await Promise.all([
        loadState(),
        apiService.getUserProfile(),
      ]);
      setState(initialState);
    } catch (error) {
      console.error("Erro ao carregar estado inicial:", error);
    } finally {
      setIsLoading(false);
    }
  };

  loadInitialState();
}, []);
```

---

## Melhores Práticas Implementadas

### 1. Separação de Responsabilidades

- **Componentes**: Foco na renderização e interações da UI
- **Serviços**: Lógica de negócio e comunicação com APIs
- **Tipos**: Definições centralizadas para reuso

### 2. Gerenciamento de Estado Centralizado

- Estado global mantido no componente principal
- Funções específicas para atualizar partes do estado
- Sincronização automática com backend após alterações

### 3. Tratamento Robusto de Erros

- Captura de erros em todas as operações assíncronas
- Feedback claro ao usuário sobre falhas
- Logging para depuração

### 4. Otimização de Performance

- Uso de `useCallback` para evitar renderizações desnecessárias
- Lazy loading de componentes quando aplicável
- Paralelização de requisições independentes

### 5. Segurança

- Validação de dados no cliente antes do envio
- Armazenamento seguro de tokens de autenticação
- Verificação de permissões em rotas sensíveis

---

## Conclusão

A arquitetura frontend deste projeto demonstra uma implementação moderna e bem-estruturada de uma aplicação web, seguindo as melhores práticas do ecossistema React e TypeScript. A separação clara de responsabilidades, o gerenciamento eficiente de estado e o tratamento robusto de operações assíncronas criam uma base sólida para aplicações escaláveis e mantíveis.

O fluxo de dados é unidirecional e previsível, facilitando o debug e a evolução do sistema. A comunicação com o backend é centralizada através de serviços especializados, garantindo consistência e reaproveitamento de código.

Esta abordagem permite que a aplicação cresça em complexidade sem comprometer a manutenibilidade, mantendo uma experiência de usuário responsiva e robusta.
