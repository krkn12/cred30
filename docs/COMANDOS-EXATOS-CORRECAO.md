# 🚨 COMANDOS EXATOS PARA CORREÇÃO COMPLETA

## Execute os comandos abaixo EXATAMENTE como estão escritos:

### 1. Instalar Dependências (NO TERMINAL, na pasta backend)

```bash
cd backend
bun add uuid @types/uuid @types/pg
```

### 2. Executar Script de Correção do Banco

```bash
node scripts/fix-database-uuid.js
```

### 3. Iniciar o Backend

```bash
npm run dev
```

---

## 📋 Se algum comando der erro, execute este primeiro:

```bash
# Instalar dependências manualmente
cd backend
npm install uuid @types/uuid @types/pg

# Depois executar o script de correção
node scripts/fix-database-uuid.js

# Iniciar backend
npm run dev
```

---

## 🔧 Alternativa: Usar npm em vez de bun

Se bun não funcionar:

```bash
cd backend
npm install
npm install uuid @types/uuid @types/pg
node scripts/fix-database-uuid.js
npm run dev
```

---

## ✅ Verificação Final

Após executar os comandos, você deve ver:

```
Conectado ao PostgreSQL com sucesso!
Tabelas criadas/verificadas com sucesso!
🎉 Banco de dados corrigido com sucesso!
```

E o backend deve iniciar sem erros.

---

## 🚨 IMPORTANTE

- Execute os comandos **EXATAMENTE** como estão escritos
- Esteja na pasta **backend** quando executar
- Se der erro, tente a alternativa com npm
- **Não pule nenhum passo**
