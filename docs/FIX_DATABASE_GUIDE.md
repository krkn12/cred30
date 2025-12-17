# Guia Rápido: Corrigir Erro de Banco de Dados CRED30

## 🚨 Problema Identificado

Erro de chave estrangeira na tabela `loan_installments`:

```
error: foreign key constraint "loan_installments_loan_id_fkey" cannot be implemented
detail: "Key columns \"loan_id\" and \"id\" are of incompatible types: integer and uuid."
```

## 🔧 Solução Imediata

### Opção 1: Usar Scripts Corrigidos (Recomendado)

```bash
# 1. Resetar banco com script corrigido
cd backend
node scripts/reset-db-fixed.js

# 2. Popular dados com script corrigido
node scripts/populate-test-data.js
```

### Opção 2: Manualmente

```bash
# 1. Parar backend (Ctrl+C)
# 2. Limpar banco completamente
docker compose -f docker-compose.single-ngrok.yml down -v
# 3. Iniciar novamente
docker compose -f docker-compose.single-ngrok.yml up -d
# 4. Usar script corrigido
cd backend && node scripts/init-db-fixed.js
```

## 📁 Arquivos Corrigidos Criados

- **`backend/scripts/init-db-fixed.sql`** - Schema corrigido com `loan_installments`
- **`backend/scripts/reset-db-fixed.js`** - Reset com schema corrigido
- **`backend/scripts/populate-test-data.js`** - Dados atualizados com parcelas

## 🔧 O que foi Corrigido

### 1. Schema da Tabela

```sql
-- ANTES (com erro):
CREATE TABLE loan_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id),  -- OK
    -- ...
);

-- DEPOIS (corrigido):
CREATE TABLE loan_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,  -- Adicionado CASCADE
    -- ...
);
```

### 2. Índices e Triggers

```sql
-- Adicionados índices para loan_installments:
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan_id ON loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_installments_status ON loan_installments(status);

-- Adicionado trigger para loan_installments:
CREATE TRIGGER update_loan_installments_updated_at BEFORE UPDATE ON loan_installments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3. Dados de Teste

```javascript
// Adicionadas parcelas para empréstimos aprovados:
for (let i = 1; i <= 3; i++) {
  await pool.query(
    `
    INSERT INTO loan_installments (loan_id, installment_number, amount, due_date, status) 
    VALUES ($1, $2, $3, $4, $5)
  `,
    [
      loan1Id,
      i,
      500 / 3,
      new Date(Date.now() + i * 10 * 24 * 60 * 60 * 1000),
      i === 1 ? "paid" : "pending",
    ]
  );
}
```

## 🚀 Como Usar

### Passo 1: Resetar Banco

```bash
cd backend
node scripts/reset-db-fixed.js
```

### Passo 2: Popular Dados

```bash
node scripts/populate-test-data.js
```

### Passo 3: Iniciar Backend

```bash
bun run dev
# ou
npm run dev-simple
```

### Passo 4: Testar

```bash
# Testar health check
curl http://localhost:3001/api/health

# Testar login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cred30.com","password":"admin123"}'
```

## 🔍 Verificação

### Após Correção

```bash
# Verificar se tabela foi criada corretamente
docker exec -it cred30-db-single psql -U cred30user -d cred30 -c "\d loan_installments"

# Verificar se dados foram inseridos
docker exec -it cred30-db-single psql -U cred30user -d cred30 -c "SELECT COUNT(*) FROM loan_installments;"
```

### Expected Output

```
                                       Table "public.loan_installments"
   Column   |            Type             | Collation | Nullable |              Default
-----------+-----------------------------+-----------+----------+----------------------------------
 id        | uuid                        |           | not null | uuid_generate_v4()
 loan_id   | uuid                        |           | not null |
 installment_number | integer          |           | not null |
 amount    | numeric(15,2)              |           | not null |
 due_date  | timestamp without time zone    |           | not null |
 paid_at   | timestamp without time zone    |           |  |
 status    | character varying(50)        |           | 'pending'::character varying
 created_at | timestamp without time zone    |           | now()
 updated_at | timestamp without time zone    |           | now()
Indexes:
    "idx_loan_installments_loan_id" btree (loan_id)
    "idx_loan_installments_status" btree (status)
```

## 🎉 Resumo da Correção

### Problema

- ❌ Chave estrangeira com tipos incompatíveis
- ❌ Tabela `loan_installments` não existia no schema original

### Solução

- ✅ Schema corrigido com tipos compatíveis
- ✅ Índices e triggers adicionados
- ✅ Dados de teste incluem parcelas
- ✅ Scripts automatizados para reset e populate

### Próximo Passo

1. **Execute o script corrigido**: `node scripts/reset-db-fixed.js`
2. **Popule os dados**: `node scripts/populate-test-data.js`
3. **Inicie o backend**: `bun run dev`
4. **Teste com ngrok**: `.\start-single-ngrok.ps1`

---

## 📞 Se o Problema Persistir

### 1. Verificar Versão PostgreSQL

```bash
docker exec -it cred30-db-single psql --version
```

### 2. Limpar Tudo e Recomeçar

```bash
# Parar tudo
docker compose -f docker-compose.single-ngrok.yml down -v

# Limpar imagens
docker system prune -f

# Recomeçar
docker compose -f docker-compose.single-ngrok.yml up -d
```

### 3. Usar Schema Manual

```bash
# Entrar no container
docker exec -it cred30-db-single psql -U cred30user -d cred30

# Executar schema corrigido manualmente
\i /docker-entrypoint-initdb.d/init-db-fixed.sql
```

Com esta correção, o banco de dados deve funcionar perfeitamente com a tabela de parcelas de empréstimos!
