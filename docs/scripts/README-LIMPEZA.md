# Script de Limpeza - Caixa Operacional

## 🎯 **Objetivo**

Script para limpar dados sensíveis do banco de dados "Caixa Operacional" de forma segura e controlada.

## ⚠️ **AVISO IMPORTANTE**

**ESTE SCRIPT APAGARÁ DADOS DO BANCO!**

- Faça **BACKUP** antes de executar
- Use com **cuidado** e apenas quando necessário
- Verifique se tem permissões adequadas

## 🛠️ **O que o script faz:**

### 1. **Limpar com PostgreSQL (psql)**

- Conecta diretamente ao banco PostgreSQL
- Executa `TRUNCATE` nas tabelas principais
- Reseta auto-incrementos
- **Mais rápido e eficiente**

### 2. **Limpar com Scripts Node.js**

- Usa scripts existentes do projeto
- `clean-database.js`
- `reset-database.js`
- `clear-expired-tokens.js`

### 3. **Gerar SQL Manual**

- Cria arquivo SQL para execução manual
- Permite revisão antes de executar
- **Mais seguro** para ambientes de produção

## 📋 **Tabelas que serão limpas:**

- `transacoes` - Transações financeiras
- `movimentacoes_caixa` - Movimentações do caixa
- `lancamentos` - Lançamentos diversos
- `operacoes_financeiras` - Operações financeiras
- `saldo_diario` - Saldo diário
- `auditoria_caixa` - Logs de auditoria

## 🚀 **Como Usar:**

### Modo Interativo (Recomendado)

```bash
./scripts/limpar-caixa-operacional.sh
```

### Modo Direto via Parâmetros

```bash
# Limpar com PostgreSQL
./scripts/limpar-caixa-operacional.sh --psql

# Limpar com scripts Node.js
./scripts/limpar-caixa-operacional.sh --node

# Gerar SQL para execução manual
./scripts/limpar-caixa-operacional.sh --sql

# Limpeza completa (todos os métodos)
./scripts/limpar-caixa-operacional.sh --complete

# Ver ajuda
./scripts/limpar-caixa-operacional.sh --help
```

## 🔧 **Configuração:**

O script usa variáveis de ambiente:

```bash
# Configurações do banco (padrão)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=caixa_operacional
DB_USER=postgres

# Ou carregue de arquivo .env
source .env
# ou
source packages/backend/.env
```

## 📁 **Arquivos Gerados:**

- `/tmp/clean_caixa.sql` - SQL gerado para execução manual
- Logs das operações no terminal

## 🔒 **Segurança:**

### Antes de Executar:

1. **Backup do banco:**

   ```bash
   pg_dump caixa_operacional > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Verifique permissões:**

   ```bash
   # Usuário deve ter permissão no banco
   psql -h localhost -U postgres -d caixa_operacional -c "\dt"
   ```

3. **Ambiente de teste:**
   - Teste primeiro em ambiente de desenvolvimento
   - Nunca execute diretamente em produção sem testar

### Durante Execução:

- **Monitore o processo** - pode demorar em bancos grandes
- **Verifique os logs** - qualquer erro será mostrado
- **Não interrompa** - pode deixar o banco em estado inconsistente

### Depois de Executar:

1. **Verifique as tabelas:**

   ```bash
   psql -h localhost -U postgres -d caixa_operacional -c "SELECT COUNT(*) FROM transacoes;"
   ```

2. **Verifique se os dados foram limpos:**
   ```bash
   psql -h localhost -U postgres -d caixa_operacional -c "\dt"
   ```

## 🚨 **Recuperação:**

Se algo der errado:

1. **Restaure do backup:**

   ```bash
   psql -h localhost -U postgres -d caixa_operacional < backup_20241215_143022.sql
   ```

2. **Verifique integridade:**
   ```bash
   psql -h localhost -U postgres -d caixa_operacional -c "SELECT COUNT(*) FROM transacoes;"
   ```

## 🔍 **Solução de Problemas:**

### "psql: command not found"

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# CentOS/RHEL
sudo yum install postgresql

# macOS
brew install postgresql
```

### "Permissão negada"

```bash
# Verifique usuário do banco
sudo -u postgres psql -d caixa_operacional -c "\du"

# Adicione permissão (se necessário)
sudo -u postgres psql -d caixa_operacional -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO seu_usuario;"
```

### "Banco não encontrado"

```bash
# Verifique se o banco existe
psql -h localhost -U postgres -c "\l"

# Crie se necessário
sudo -u postgres createdb caixa_operacional
```

## 📝 **Logs e Auditoria:**

O script não remove logs de auditoria recentes (últimos 90 dias), apenas:

- Transações antigas (mais de 30 dias)
- Movimentações antigas (mais de 30 dias)
- Sessões expiradas

Logs importantes são mantidos para:

- **Compliance e auditoria**
- **Investigação de problemas**
- **Histórico de acesso**

## 🔄 **Agendamento:**

Para limpeza automática (cuidado!):

```bash
# Adicione ao crontab (executa todo dia 1 às 2h da manhã)
crontab -e

# Linha para adicionar:
0 2 1 * * /caminho/do/projeto/scripts/limpar-caixa-operacional.sh --complete
```

## 🎯 **Recomendações:**

1. **Ambientes:**
   - **Desenvolvimento**: Limpeza completa (`--complete`)
   - **Homologação**: Limpeza parcial (`--psql`)
   - **Produção**: Apenas SQL manual (`--sql`)

2. **Frequência:**
   - **Desenvolvimento**: Diária ou quando necessário
   - **Produção**: Mensal ou trimestral
   - **Homologação**: Semanal

3. **Backup:**
   - **Automático**: Antes de qualquer limpeza
   - **Manual**: Sempre antes de operações críticas

## 📞 **Suporte:**

Em caso de problemas:

1. **Verifique os logs** do script
2. **Confirme as permissões** do banco
3. **Teste em ambiente seguro** antes
4. **Mantenha backups** recentes

---

**⚠️ LEMBRE-SE: Dados perdidos NÃO podem ser recuperados sem backup!**
