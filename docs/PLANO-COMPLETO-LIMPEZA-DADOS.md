# Plano Completo de Limpeza Permanente de Dados - CRED30

## 🎯 **Objetivo**

Este documento descreve um plano abrangente e seguro para a limpeza permanente de todos os dados de usuários e transações da aplicação financeira CRED30, preservando apenas o esquema do banco, configurações do sistema e o administrador principal (`josiassm701@gmail.com`).

---

## 📋 **Sumário Executivo**

A aplicação CRED30 gerencia cotas de investimento, empréstimos, saldos e transações financeiras. Este plano oferece duas abordagens de limpeza:

1. **Limpeza Seletiva**: Remove todos os dados de usuários regulares e transações, preservando o administrador principal
2. **Limpeza Completa**: Remove 100% de todos os dados, incluindo o administrador

Ambas as abordagens mantêm a integridade do esquema do banco e permitem a continuidade das operações.

---

## 🏗️ **Arquitetura do Banco de Dados**

### Tabelas Principais Identificadas

| Tabela              | Descrição                | Dados Sensíveis         | Ação de Limpeza   |
| ------------------- | ------------------------ | ----------------------- | ----------------- |
| `users`             | Usuários do sistema      | Dados pessoais, senhas  | Seletiva/Completa |
| `quotas`            | Cotas de investimento    | Valores financeiros     | Completa          |
| `loans`             | Empréstimos concedidos   | Dados financeiros       | Completa          |
| `loan_installments` | Parcelas de empréstimos  | Dados financeiros       | Completa          |
| `transactions`      | Transações financeiras   | Histórico completo      | Completa          |
| `withdrawals`       | Saques realizados        | Dados financeiros       | Completa          |
| `app_settings`      | Configurações do sistema | Parâmetros operacionais | Preservar         |

### Relacionamentos e Dependências

```
users (1) → (N) quotas
users (1) → (N) loans
users (1) → (N) transactions
users (1) → (N) withdrawals
loans (1) → (N) loan_installments
```

---

## 🛡️ **Fase 1: Preparação e Backup**

### 1.1 Backup Completo do Banco

**Script**: [`scripts/database/backup-database.sh`](scripts/database/backup-database.sh)

**Comandos de Backup (PostgreSQL)**:

```bash
# Backup completo com compressão
pg_dump -h localhost -p 5432 -U postgres -d cred30 \
    --verbose \
    --clean \
    --no-acl \
    --no-owner \
    --format=custom \
    --file=cred30_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup compactado
pg_dump -h localhost -p 5432 -U postgres -d cred30 | gzip > cred30_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Verificação de Integridade do Backup**:

```bash
# Criar banco de teste
createdb cred30_test_backup

# Restaurar backup
pg_restore -h localhost -p 5432 -U postgres -d cred30_test_backup --clean --if-exists backup_file.sql.gz

# Verificar contagem de registros
psql -h localhost -p 5432 -U postgres -d cred30_test_backup -c "
SELECT
    'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'quotas', COUNT(*) FROM quotas
UNION ALL
SELECT 'loans', COUNT(*) FROM loans
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions;
"

# Remover banco de teste
dropdb cred30_test_backup
```

### 1.2 Verificação de Pré-requisitos

- ✅ PostgreSQL client tools instalados
- ✅ Permissões de administrador no banco
- ✅ Espaço em disco suficiente (2x tamanho do banco)
- ✅ Conectividade com o banco de dados
- ✅ Ambiente de teste disponível

---

## 🔍 **Fase 2: Identificação de Dados**

### 2.1 Análise das Tabelas

**Script**: [`scripts/database/identify-tables.sql`](scripts/database/identify-tables.sql)

Este script realiza:

- Contagem completa de registros em todas as tabelas
- Identificação de usuários administradores vs regulares
- Análise de valores financeiros acumulados
- Verificação de integridade referencial
- Classificação das tabelas quanto à necessidade de limpeza

### 2.2 Tabelas que Devem Ser Limpadas

**Dados de Usuários e Transações**:

- `users` (exceto administrador principal)
- `quotas` (todas as cotas de investimento)
- `loans` (todos os empréstimos)
- `loan_installments` (todas as parcelas)
- `transactions` (todas as transações financeiras)
- `withdrawals` (todos os saques)

**Dados que Devem Ser Preservados**:

- `app_settings` (configurações do sistema)
- `users` (apenas o administrador principal: `josiassm701@gmail.com`)

---

## 🧹 **Fase 3: Scripts de Limpeza**

### 3.1 Script de Limpeza Seletiva

**Script**: [`scripts/database/wipe-user-data.sql`](scripts/database/wipe-user-data.sql)

**Características**:

- Preserva o administrador principal (`josiassm701@gmail.com`)
- Remove todos os usuários regulares
- Remove todas as transações financeiras
- Mantém configurações do sistema
- Reseta sequências de auto-incremento

**Fluxo de Execução**:

1. Verificação de segurança (presença do admin)
2. Desabilitar triggers e constraints
3. Limpeza em ordem inversa de dependências
4. Limpeza seletiva de usuários
5. Reset de sequências
6. Verificação de consistência

### 3.2 Script de Limpeza Completa

**Script**: [`scripts/database/wipe-all-data.sql`](scripts/database/wipe-all-data.sql)

**Características**:

- Remove 100% de todos os dados
- Inclusive o administrador principal
- Remove configurações do sistema
- Deixa o banco completamente vazio
- Requer reconfiguração completa

### 3.3 Diferenças Entre TRUNCATE e DELETE

| Operação        | TRUNCATE                 | DELETE             |
| --------------- | ------------------------ | ------------------ |
| Velocidade      | Rápido (bulk operation)  | Lento (row-by-row) |
| Transações      | Não pode ser rollback    | Pode ser rollback  |
| Triggers        | Não dispara              | Dispara            |
| Sequências      | Reseta automaticamente   | Não reseta         |
| Foreign Keys    | RESTART IDENTITY CASCADE | Manual             |
| Uso Recomendado | Limpeza completa         | Limpeza seletiva   |

---

## ✅ **Fase 4: Verificação Pós-Limpeza**

### 4.1 Script de Verificação

**Script**: [`scripts/database/verify-cleanup.sql`](scripts/database/verify-cleanup.sql)

**Verificações Realizadas**:

1. **Contagem de Registros**:
   - Verifica se tabelas de dados estão vazias
   - Confirma presença do administrador (limpeza seletiva)
   - Valida presença de configurações

2. **Integridade Referencial**:
   - Verifica ausência de registros órfãos
   - Valida consistência de foreign keys

3. **Estado das Sequências**:
   - Confirma reset das sequências
   - Verifica valores iniciais

4. **Configurações do Sistema**:
   - Valida presença de configurações essenciais
   - Verifica valores críticos

### 4.2 Testes Funcionais

**Acesso do Administrador**:

```bash
# Verificar se o administrador pode acessar
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "josiassm701@gmail.com",
    "password": "senha_admin"
  }'
```

**Verificação da Interface**:

- Acessar painel administrativo
- Verificar ausência de dados de usuários
- Confirmar funcionalidades disponíveis

---

## 🚀 **Fase 5: Execução Automatizada**

### 5.1 Script Master de Execução

**Script**: [`scripts/database/execute-cleanup.sh`](scripts/database/execute-cleanup.sh)

**Fluxo Completo Automatizado**:

1. Carregamento de variáveis de ambiente
2. Verificação de dependências
3. Teste de conexão
4. Criação de backup automático
5. Identificação de tabelas
6. Execução da limpeza (seletiva ou completa)
7. Verificação pós-limpeza
8. Relatório final e recomendações

### 5.2 Modos de Execução

**Limpeza Seletiva**:

```bash
./scripts/database/execute-cleanup.sh selective
```

**Limpeza Completa**:

```bash
./scripts/database/execute-cleanup.sh complete
```

---

## ⚠️ **Fase 6: Avisos e Considerações Finais**

### 6.1 Avisos Críticos

🚨 **AVISO EXTREMO**:

- **ESTA OPERAÇÃO É IRREVERSÍVEL**
- **NÃO HÁ COMO RECUPERAR DADOS SEM BACKUP**
- **EXECUTE PRIMEIRO EM AMBIENTE DE TESTE**

### 6.2 Considerações de Produção

**Ambientes Recomendados**:

- **Desenvolvimento**: Limpeza completa ou seletiva conforme necessário
- **Homologação**: Limpeza seletiva para testes com admin preservado
- **Produção**: Apenas com autorização formal e backup verificado

**Timing da Operação**:

- Executar em horário de baixo tráfego
- Comunicar aos usuários com antecedência
- Preparar plano de rollback

### 6.3 Requisitos de Compliance

**Documentação Necessária**:

- Registro da operação executada
- Justificativa da limpeza
- Autorização formal
- Backup armazenado com segurança
- Relatório pós-operação

**Retenção de Dados**:

- Verificar políticas de retenção aplicáveis
- Considerar requisitos regulatórios
- Avaliar necessidade de anonimização vs deleção

---

## 📊 **Fase 7: Relatório de Execução**

### 7.1 Métricas de Sucesso

**Antes da Limpeza**:

- Total de usuários: [quantidade]
- Total de transações: [quantidade]
- Volume financeiro: [valor]
- Tamanho do banco: [tamanho]

**Após a Limpeza**:

- Usuários remanescentes: 1 (admin) ou 0
- Transações remanescentes: 0
- Configurações preservadas: [quantidade]
- Redução do tamanho: [percentual]

### 7.2 Checklist de Verificação Final

- [ ] Backup criado e verificado
- [ ] Scripts executados sem erros
- [ ] Verificação pós-limpeza aprovada
- [ ] Administrador pode acessar (se aplicável)
- [ ] Interface funcionando corretamente
- [ ] Logs sem erros críticos
- [ ] Documentação atualizada
- [ ] Equipe notificada

---

## 🔄 **Fase 8: Procedimentos de Recuperação**

### 8.1 Rollback Completo

```bash
# Parar aplicação
sudo systemctl stop cred30-backend

# Restaurar backup
gunzip -c cred30_backup_YYYYMMDD_HHMMSS.sql.gz | \
psql -h localhost -p 5432 -U postgres -d cred30

# Reiniciar aplicação
sudo systemctl start cred30-backend

# Verificar funcionamento
./scripts/database/verify-cleanup.sql
```

### 8.2 Recuperação Parcial

Em caso de falha parcial:

1. Identificar tabelas afetadas
2. Restaurar backup apenas das tabelas necessárias
3. Reexecutar limpeza seletiva
4. Verificar integridade

---

## 📞 **Suporte e Contingência**

### Contatos de Emergência

- Administrador do Banco: [contato]
- Desenvolvedor Principal: [contato]
- Gerente de Operações: [contato]

### Planos de Contingência

1. **Falha no Backup**: Interromper operação, investigar causa
2. **Falha na Limpeza**: Analisar logs, executar rollback
3. **Falha na Verificação**: Investigar inconsistências, corrigir manualmente
4. **Falha na Aplicação**: Restaurar backup completo

---

## 📝 **Histórico de Revisões**

| Versão | Data       | Autor    | Alterações     |
| ------ | ---------- | -------- | -------------- |
| 1.0    | 2025-12-15 | DB Admin | Versão inicial |
|        |            |          |                |

---

## 📚 **Referências**

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [CRED30 System Architecture](docs/DOCUMENTACAO-ARQUITETURAL.md)
- [Database Initialization Script](scripts/database/init-db-fixed.sql)

---

**⚠️ LEMBRE-SE: A segurança dos dados é responsabilidade de todos. Execute este plano apenas quando absolutamente necessário e com todas as precauções em vigor.**
