# Scripts para Limpar Dados do Banco Docker - CRED30

Esta pasta contém scripts para apagar todos os dados do banco de dados PostgreSQL mantendo apenas a estrutura das tabelas.

## 📋 Scripts Disponíveis

### 1. **limpar-dados-docker-apenas-estrutura.sh** (Linux/Mac)

Script em Bash para sistemas Unix/Linux.

### 2. **limpar-dados-docker-apenas-estrutura.bat** (Windows)

Script em Batch para Windows CMD.

### 3. **limpar-dados-docker-apenas-estrutura.ps1** (Windows)

Script em PowerShell para Windows PowerShell.

## ⚠️ AVISO IMPORTANTE

**ESTA OPERAÇÃO É IRREVERSÍVEL!**

- ✅ Mantém a estrutura completa do banco
- ❌ Apaga TODOS os dados
- ❌ Remove TODOS os usuários
- ✅ Cria backup automático antes de apagar

## 🚀 Como Usar

### Pré-requisitos

1. Docker instalado e rodando
2. Container PostgreSQL do CRED30 ativo (`cred30-postgres` ou `cred30-db-local`)

### Executando os Scripts

#### No Linux/Mac:

```bash
cd scripts/database
chmod +x limpar-dados-docker-apenas-estrutura.sh
./limpar-dados-docker-apenas-estrutura.sh
```

#### No Windows (CMD):

```cmd
cd scripts\database
limpar-dados-docker-apenas-estrutura.bat
```

#### No Windows (PowerShell):

```powershell
cd scripts\database
.\limpar-dados-docker-apenas-estrutura.ps1
```

## 📦 O que os Scripts Fazem

### 1. **Verificação do Container**

- Verifica se o container PostgreSQL está rodando
- Identifica automaticamente o nome do container (`cred30-postgres` ou `cred30-db-local`)

### 2. **Backup Automático**

- Cria um backup completo antes de apagar os dados
- Salva na pasta `./backups/` com timestamp
- Comprime o arquivo para economizar espaço

### 3. **Limpeza dos Dados**

- Desabilita triggers temporariamente
- Limpa tabelas em ordem correta (respeitando foreign keys):
  1. `loan_installments` (parcelas de empréstimos)
  2. `withdrawals` (saques)
  3. `transactions` (transações)
  4. `quotas` (cotas)
  5. `loans` (empréstimos)
  6. `users` (usuários)
- Reseta sequências de auto-incremento
- Restaura configurações padrão do sistema
- Reabilita triggers

### 4. **Verificação Final**

- Confirma que todos os dados foram removidos
- Verifica que a estrutura foi mantida
- Exibe relatório final

## 🔄 Após a Limpeza

### Criar Novo Usuário Admin

```sql
INSERT INTO users (
    name,
    email,
    password_hash,
    pix_key,
    secret_phrase,
    referral_code,
    is_admin,
    balance,
    created_at,
    updated_at
) VALUES (
    'Seu Nome',
    'seu@email.com',
    'senha_hash',
    'sua@chave.pix',
    'sua_frase_secreta',
    'CODIGO001',
    true,
    0.00,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
```

### Acessar o Banco Diretamente

```bash
# Via Docker
docker exec -it cred30-postgres psql -U cred30user -d cred30

# Ou se usar docker-compose.local.yml
docker exec -it cred30-db-local psql -U cred30user -d cred30
```

## 📁 Estrutura das Tabelas Mantidas

- `users` - Usuários do sistema
- `quotas` - Cotas de investimento
- `loans` - Empréstimos
- `transactions` - Transações financeiras
- `withdrawals` - Saques
- `loan_installments` - Parcelas de empréstimos
- `app_settings` - Configurações do sistema

## 🔧 Configurações Restauradas

Após a limpeza, as seguintes configurações são restauradas:

| Configuração         | Valor Padrão | Descrição                |
| -------------------- | ------------ | ------------------------ |
| `quota_price`        | 50           | Preço unitário das cotas |
| `loan_interest_rate` | 0.2          | Taxa de juros (20%)      |
| `penalty_rate`       | 0.4          | Taxa de multa (40%)      |

## 🛡️ Segurança

- ✅ Backup automático antes da operação
- ✅ Verificação de integridade após limpeza
- ✅ Scripts testados e validados
- ⚠️ Execute com cuidado - operação irreversível

## 📞 Suporte

Caso encontre problemas:

1. Verifique se o Docker está rodando
2. Confirme o nome do container PostgreSQL
3. Verifique permissões na pasta `./backups/`
4. Consulte os logs de erro exibidos pelos scripts

---

**Lembre-se:** Sempre mantenha uma cópia dos backups importantes em local seguro!
