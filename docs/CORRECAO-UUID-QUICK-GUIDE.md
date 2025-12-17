# 🚨 Guia Rápido: Correção do Erro de UUID no Banco de Dados

## Problema Identificado

O erro `foreign key constraint "loan_installments_loan_id_fkey" cannot be implemented` ocorre porque há uma mistura de tipos de dados no banco:

- Tabelas criadas com `SERIAL PRIMARY KEY` (INTEGER)
- Tentativa de criar FK para `UUID`

## ✅ Solução Imediata

### 1. Instalar Dependências do Backend

```bash
cd backend
npm install uuid @types/uuid
```

### 2. Executar Script de Correção

```bash
# Estar no diretório backend/
node scripts/fix-database-uuid.js
```

### 3. Iniciar o Backend

```bash
npm run dev
```

## 🔧 O Que o Script Faz

1. **Remove completamente** o banco de dados antigo
2. **Cria novo banco** com schema limpo
3. **Configura UUID** para todas as tabelas
4. **Cria índices** otimizados
5. **Insere dados iniciais** do sistema

## 📋 Schema Corrigido

Todas as tabelas agora usam `UUID PRIMARY KEY`:

- ✅ `users.id` = UUID
- ✅ `loans.id` = UUID
- ✅ `loan_installments.loan_id` = UUID (FK correta)
- ✅ `quotas.id` = UUID
- ✅ `transactions.id` = UUID

## 🚀 Após Correção

1. **Backend funcionará** sem erros de FK
2. **Primeiro usuário** cadastrado será automaticamente admin
3. **Sistema pronto** para desenvolvimento local

## 📱 Acesso Após Correção

```
Frontend:    http://localhost:5173
Backend:     http://localhost:3001
Primeiro Admin: Cadastre-se no frontend
```

## 🔄 Se Ocorrer Outros Erros

```bash
# Reset completo (se necessário)
node scripts/fix-database-uuid.js

# Verificar schema
psql -h localhost -U cred30user -d cred30 -c "\dt"
```

---

## ⚡ Comandos Únicos (Copiar e Colar)

```bash
# 1. Instalar dependências
cd backend && npm install uuid @types/uuid

# 2. Corrigir banco de dados
node scripts/fix-database-uuid.js

# 3. Iniciar backend
npm run dev
```

**Pronto! Sistema corrigido e funcionando.** 🎉
