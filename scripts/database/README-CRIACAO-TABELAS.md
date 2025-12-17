# Guia de Criação de Tabelas Faltantes - CRED30

## Overview

Este guia explica como criar todas as tabelas faltantes no banco de dados do sistema CRED30, com base na análise completa do frontend e backend.

## Análise Realizada

### Tabelas Identificadas no Backend

Através da análise dos arquivos de rotas do backend, foram identificadas as seguintes tabelas referenciadas:

1. **users** - Usuários do sistema
2. **system_config** - Configurações do sistema
3. **quotas** - Cotas de investimento
4. **loans** - Empréstimos
5. **loan_installments** - Parcelas de empréstimos
6. **transactions** - Transações financeiras
7. **audit_logs** - Logs de auditoria
8. **user_sessions** - Sessões de usuário
9. **notifications** - Notificações
10. **notification_settings** - Configurações de notificação
11. **referrals** - Indicações
12. **referral_bonuses** - Bônus de indicação
13. **support_tickets** - Tickets de suporte
14. **support_responses** - Respostas de suporte

### Tabelas Adicionais Recomendadas

Com base na análise do frontend e melhores práticas, foram adicionadas:

15. **system_settings** - Configurações gerais do sistema
16. **daily_reports** - Relatórios diários
17. **user_statistics** - Estatísticas de usuário
18. **system_fees** - Taxas do sistema
19. **fee_history** - Histórico de taxas
20. **backup_logs** - Logs de backup

## Scripts Disponíveis

### 1. Script SQL Principal

- **Arquivo**: `create-missing-tables.sql`
- **Descrição**: Script SQL completo com todas as tabelas, índices, triggers e views
- **Uso**: Pode ser executado diretamente no PostgreSQL

### 2. Script Docker (Linux/Mac)

- **Arquivo**: `create-missing-tables-docker.sh`
- **Descrição**: Script bash para executar a criação via Docker
- **Uso**: `./create-missing-tables-docker.sh`

### 3. Script Docker (Windows PowerShell)

- **Arquivo**: `create-missing-tables-docker.ps1`
- **Descrição**: Script PowerShell para executar a criação via Docker no Windows
- **Uso**: `.\create-missing-tables-docker.ps1`

## Como Usar

### Pré-requisitos

1. **Docker instalado e rodando**
2. **Container PostgreSQL em execução**
3. **Acesso ao diretório `scripts/database/`**

### Para Linux/Mac

```bash
# Navegar para o diretório correto
cd scripts/database/

# Dar permissão de execução ao script
chmod +x create-missing-tables-docker.sh

# Executar o script
./create-missing-tables-docker.sh
```

### Para Windows (PowerShell)

```powershell
# Navegar para o diretório correto
cd scripts\database\

# Executar o script PowerShell
.\create-missing-tables-docker.ps1
```

### Para Execução Direta no PostgreSQL

```bash
# Copiar o arquivo SQL para o container
docker cp create-missing-tables.sql postgres:/tmp/

# Executar dentro do container
docker exec -it postgres psql -U postgres -d cred30 -f /tmp/create-missing-tables.sql
```

## Estrutura das Tabelas Criadas

### Tabelas Principais

#### users

- Armazena informações dos usuários
- Campos: id, name, email, password_hash, pix_key, secret_phrase, balance, etc.
- Índices: email, referral_code, is_admin

#### system_config

- Configurações principais do sistema
- Campos: system_balance, profit_pool, quota_price, loan_interest_rate, etc.
- Mantém valores financeiros globais

#### quotas

- Cotas de investimento dos usuários
- Campos: user_id, purchase_price, current_value, purchase_date, status
- Relacionamento com users

#### loans

- Empréstimos solicitados pelos usuários
- Campos: user_id, amount, total_repayment, installments, status, etc.
- Relacionamento com users

#### transactions

- Todas as transações financeiras
- Campos: user_id, type, amount, description, status, metadata
- Tipos: BUY_QUOTA, SELL_QUOTA, LOAN_PAYMENT, WITHDRAWAL, etc.

### Tabelas de Sistema

#### audit_logs

- Logs de auditoria para rastreabilidade
- Campos: action, entity_id, entity_type, details, created_by
- Essencial para conformidade e segurança

#### user_sessions

- Sessões ativas dos usuários
- Campos: user_id, token_hash, expires_at, ip_address, user_agent
- Para gerenciamento de autenticação

#### notifications

- Sistema de notificações
- Campos: user_id, title, message, type, read, created_at
- Para comunicação com usuários

### Tabelas de Negócio

#### referrals

- Sistema de indicações
- Campos: referrer_id, referred_id, referral_code, status, bonus_amount
- Para programa de indicações

#### system_fees

- Configuração de taxas do sistema
- Campos: name, type, fee_type, fee_value, min_fee, max_fee
- Para gestão de taxas (saque, empréstimo, etc.)

#### support_tickets

- Sistema de help desk
- Campos: user_id, subject, message, status, priority, category
- Para suporte ao cliente

## Índices Criados

Para garantir performance, foram criados índices estratégicos:

- **users**: email, referral_code, is_admin
- **quotas**: user_id, status, purchase_date
- **loans**: user_id, status, due_date, created_at
- **transactions**: user_id, type, status, created_at
- **audit_logs**: action, entity_type, created_by, created_at

## Triggers Automáticos

Foi implementado um trigger para atualização automática do campo `updated_at`:

- **Função**: `update_updated_at_column()`
- **Aplicado a todas as tabelas principais**
- **Garante consistência de timestamps**

## Views Criadas

### user_financial_summary

View que consolida informações financeiras do usuário:

- Saldo atual
- Total de cotas
- Total investido
- Total emprestado
- Total sacado

### admin_dashboard

View para dashboard administrativo com:

- Total de usuários
- Cotas ativas
- Empréstimos ativos
- Valores financeiros globais

## Dados Iniciais

O script insere automaticamente:

### Configurações do Sistema

- Valores padrão para taxas
- Configurações de negócio
- Limites do sistema

### Taxas Padrão

- Taxa de saque: 2% ou R$ 5,00 (maior valor)
- Taxa de empréstimo: 20%
- Multa de resgate antecipado: 40%

### Configurações Gerais

- Modo de manutenção
- Limites de saque
- Bônus de indicação
- Limites máximos

## Verificação Pós-Criação

Os scripts de automação verificam automaticamente:

1. **Contagem de tabelas criadas**
2. **Verificação de tabelas críticas**
3. **Contagem de índices**
4. **Verificação de triggers**
5. **Verificação de views**
6. **Configurações do sistema**
7. **Usuários administradores**

## Solução de Problemas

### Container PostgreSQL não encontrado

```bash
# Verificar containers em execução
docker ps

# Iniciar container PostgreSQL
docker start postgres

# Ou via docker-compose
docker-compose up -d postgres
```

### Erro de permissão no Docker

```bash
# Linux/Mac
sudo usermod -aG docker $USER
# Fazer logout e login novamente

# Windows
# Executar PowerShell como Administrador
```

### Credenciais incorretas

O script tenta automaticamente:

1. Usuário `postgres`
2. Usuário `cred30user`

Se nenhum funcionar, verifique o arquivo `docker-compose.yml`.

### Tabelas já existentes

O script usa `CREATE TABLE IF NOT EXISTS`, então pode ser executado várias vezes sem problemas.

## Comandos Úteis

### Verificar estrutura de uma tabela

```bash
docker exec postgres psql -U postgres -d cred30 -c "\d nome_tabela"
```

### Contar registros em uma tabela

```bash
docker exec postgres psql -U postgres -d cred30 -c "SELECT COUNT(*) FROM nome_tabela;"
```

### Verificar todas as tabelas

```bash
docker exec postgres psql -U postgres -d cred30 -c "\dt"
```

### Fazer backup completo

```bash
docker exec postgres pg_dump -U postgres cred30 > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar backup

```bash
docker exec -i postgres psql -U postgres -d cred30 < backup_arquivo.sql
```

## Próximos Passos

Após criar as tabelas:

1. **Testar a aplicação frontend**
   - Verificar se todas as funcionalidades funcionam
   - Testar cadastro, login, operações financeiras

2. **Verificar logs do backend**
   - Procurar por erros relacionados ao banco
   - Verificar se todas as queries funcionam

3. **Executar testes de integração**
   - Testar fluxos completos do usuário
   - Verificar operações administrativas

4. **Fazer backup completo**
   - Após confirmar que tudo funciona
   - Guardar cópia de segurança

5. **Documentar alterações**
   - Atualizar documentação do projeto
   - Registrar mudanças no controle de versão

## Considerações de Segurança

1. **Backup antes de executar**
   - Sempre faça backup do banco antes de alterações

2. **Teste em ambiente de staging**
   - Execute primeiro em ambiente de testes

3. **Monitoramento pós-implantação**
   - Monitore logs e performance

4. **Controle de acesso**
   - Verifique permissões do banco
   - Mantenha credenciais seguras

## Suporte

Caso encontre problemas:

1. Verifique os logs de erro dos scripts
2. Confirme se o Docker está rodando corretamente
3. Verifique as credenciais do banco
4. Consulte a documentação do PostgreSQL
5. Abra uma issue no repositório do projeto

---

**Importante**: Este script foi criado com base na análise do código existente. Sempre teste em ambiente de desenvolvimento antes de aplicar em produção.
