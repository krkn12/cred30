# 📋 Guia Completo de Limpeza Segura do Banco de Dados CRED30

## 🚨 AVISO IMPORTANTE

Este documento contém orientações CRÍTICAS para gerenciar a limpeza do banco de dados do CRED30 de forma segura. **LEIA COM ATENÇÃO** antes de executar qualquer comando.

---

## 🎯 Objetivo

Fornecer métodos seguros e controlados para limpar dados do banco PostgreSQL em contêiner Docker, evitando corrupção de dados e permitindo recuperação em caso de erros.

---

## 📁 Scripts Disponíveis

### 1. 🛡️ Script Seguro Multiplataforma

**Arquivos:**

- `scripts/database/secure-database-cleanup.sh` (Linux/Mac)
- `scripts/database/secure-database-cleanup.ps1` (Windows)

**Características:**

- ✅ Menu interativo com 5 opções
- ✅ Backup automático antes de qualquer operação
- ✅ Verificação de integridade após limpeza
- ✅ Tratamento de erros robusto
- ✅ Logs detalhados de todas operações

---

## 🔧 Níveis de Limpeza

### Nível 1: 🛡️ Limpeza Segura (Recomendado)

**O que faz:**

- Remove apenas os dados das tabelas
- Mantém estrutura completa (tabelas, índices, triggers)
- Preserva usuário admin
- Mantém configurações básicas

**Quando usar:**

- ✅ Ambiente de desenvolvimento
- ✅ Testes que precisam de estrutura intacta
- ✅ Manutenção regular do sistema

**Comandos:**

```bash
# Linux/Mac
chmod +x scripts/database/secure-database-cleanup.sh
./scripts/database/secure-database-cleanup.sh

# Windows PowerShell
.\scripts\database\secure-database-cleanup.ps1
```

### Nível 2: 🔄 Limpeza Completa

**O que faz:**

- Dropa e recria todas as tabelas
- Mantém configurações básicas
- Insere usuário admin padrão

**Quando usar:**

- ⚠️ Apenas quando necessário reset completo
- ⚠️ Após mudanças estruturais no schema
- ⚠️ Como último recurso para problemas de dados

### Nível 3: 💣 Reset Total (Irreversível)

**O que faz:**

- Apaga TODO o schema público
- Recria do zero
- Perde absolutamente tudo

**⚠️ AVISO:** Use apenas em desenvolvimento extremo!

---

## 📊 Verificação de Integridade

### Antes da Limpeza

```bash
# Verificar tabelas existentes
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT table_name,
       CASE WHEN table_type = 'BASE TABLE' THEN 'Tabela'
            WHEN table_type = 'VIEW' THEN 'View'
            ELSE 'Outro'
       END as type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"

# Verificar contagens
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT
    'users' as tabela, COUNT(*) as registros FROM users
UNION ALL
SELECT
    'quotas' as tabela, COUNT(*) as registros FROM quotas
UNION ALL
SELECT
    'loans' as tabela, COUNT(*) as registros FROM loans;
"
```

### Após a Limpeza

Os scripts já incluem verificação automática, mas você pode verificar manualmente:

```bash
# Verificar se estrutura foi mantida
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('users', 'quotas', 'loans', 'transactions')
ORDER BY table_name, ordinal_position;
"
```

---

## 💾 Backup e Recuperação

### Backup Automático

Os scripts criam backup automático em `./backups/` com timestamp:

```bash
# Lista de backups disponíveis
ls -la ./backups/cred30_backup_*.sql*

# Restaurar backup específico
docker exec -i cred30-postgres psql -U cred30user -d cred30 < ./backups/backup_desejado.sql
```

### Backup Manual (Recomendado antes de operações críticas)

```bash
# Criar backup completo
docker exec cred30-postgres pg_dump -U cred30user -d cred30 > backup_manual_$(date +%Y%m%d_%H%M%S).sql

# Backup compactado
docker exec cred30-postgres pg_dump -U cred30user -d cred30 | gzip > backup_manual_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## 🚨 Sinais de Perigo e Como Evitar

### ⚠️ NUNCA FAÇA

1. **DROP DATABASE sem backup:**

   ```bash
   # ❌ NUNCA ISSO!
   docker exec cred30-postgres psql -U cred30user -d cred30 -c "DROP DATABASE cred30;"
   ```

2. **Operações em produção sem backup:**
   - Sempre crie backup antes de limpeza em produção
   - Teste scripts em ambiente de desenvolvimento primeiro

3. **Múltiplas limpezas simultâneas:**
   - Pode causar deadlocks
   - Execute uma operação por vez

4. **Ignorar mensagens de erro:**
   - Se aparecer erro, pare e investigue
   - Verifique logs do container: `docker logs cred30-postgres`

### 🔍 Verificações de Saúde do Banco

```bash
# Verificar conexões ativas
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT
    pid,
    usename,
    application_name,
    state,
    query_start,
    state_change
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
"

# Verificar tamanho do banco
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT
    pg_size_pretty(pg_database_size('cred30')) as tamanho_banco,
    pg_size_pretty(pg_total_relation_size('public')) as tamanho_tabelas;
"

# Verificar locks ativos
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT
    t.relname AS tabela,
    l.locktype AS tipo_lock,
    l.mode AS modo,
    l.granted AS concedido
FROM pg_locks l
JOIN pg_stat_user_tables t ON l.relation = t.relid;
"
```

---

## 🛠️ Solução de Problemas Comuns

### Problema: "Container não está rodando"

```bash
# Verificar status
docker ps | grep cred30-postgres

# Reiniciar se necessário
docker restart cred30-postgres

# Verificar logs
docker logs cred30-postgres --tail 50
```

### Problema: "Permissão negada"

```bash
# Verificar usuário do container
docker exec cred30-postgres id -u

# Corrigir permissões dos scripts
chmod +x scripts/database/secure-database-cleanup.sh
chmod +x scripts/database/secure-database-cleanup.ps1
```

### Problema: "Tabela não existe"

```bash
# Verificar se schema existe
docker exec cred30-postgres psql -U cred30user -d cred30 -c "\dt"

# Recriar schema se necessário
docker exec cred30-postgres psql -U cred30user -d cred30 -c "CREATE SCHEMA IF NOT EXISTS public;"
```

---

## 📋 Checklist Antes da Limpeza

- [ ] Backup atual criado e testado
- [ ] Ambiente de desenvolvimento isolado
- [ ] Scripts testados em ambiente seguro
- [ ] Usuários notificados sobre manutenção
- [ ] Documentação atualizada
- [ ] Plano de recuperação definido

---

## 📞 Suporte e Recuperação

### Em Caso de Falha

1. **Pare imediatamente** o script em execução (Ctrl+C)
2. **Verifique o estado atual:**
   ```bash
   docker exec cred30-postgres psql -U cred30user -d cred30 -c "\dt"
   ```
3. **Restaure o backup mais recente:**
   ```bash
   docker exec -i cred30-postgres psql -U cred30user -d cred30 < ./backups/backup_mais_recente.sql
   ```
4. **Verifique logs para identificar a causa:**
   ```bash
   docker logs cred30-postgres --since 1h
   ```

### Contato de Emergência

- **Documentação:** Este arquivo README-LIMPEZA-SEGURA.md
- **Scripts:** secure-database-cleanup.sh / secure-database-cleanup.ps1
- **Logs:** `docker logs cred30-postgres`

---

## 🔄 Fluxo de Trabalho Recomendado

1. **Desenvolvimento/Teste:**
   - Use Nível 1 (Limpeza Segura)
   - Cria backup automático
   - Mantém estrutura intacta

2. **Produção - Manutenção:**
   - Crie backup manual adicional
   - Use Nível 1 ou 2
   - Comunique usuários com antecedência

3. **Emergência/Reset Completo:**
   - Use Nível 3 apenas como último recurso
   - Tenha plano de reconstrução pronto
   - Documente motivo do reset

---

## 📚 Referências Rápidas

### Comandos Úteis

```bash
# Acessar o banco diretamente
docker exec -it cred30-postgres psql -U cred30user -d cred30

# Verificar tamanho de tabelas específicas
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname::text||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname::text||'.'||tablename) DESC;
"

# Verificar índices
docker exec cred30-postgres psql -U cred30user -d cred30 -c "\di"
```

### Configurações do Sistema

```bash
# Verificar configurações atuais
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT * FROM system_config;"

# Verificar configurações do app
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT * FROM app_settings;"
```

---

## ⚡ Comandos de Emergência

### Reset Rápido (Último Recurso)

```bash
# PARAR O CONTAINER PRIMEIRO
docker stop cred30-postgres

# LIMPAR DADOS DO CONTAINER
docker system prune -f

# REINICIAR COM IMAGEM LIMPA
docker-compose down
docker-compose up --force-recreate
```

### Acesso Direto ao Volume de Dados

```bash
# Encontrar volume do PostgreSQL
docker volume inspect cred30_postgres_data

# Acessar diretório de dados (CUIDADO!)
# Isso pode corromper dados se o banco estiver rodando
```

---

## 📈 Monitoramento Contínuo

### Script de Monitoramento Simples

```bash
#!/bin/bash
# monitor-banco.sh
while true; do
    echo "=== $(date) ==="
    docker exec cred30-postgres psql -U cred30user -d cred30 -c "
        SELECT
            COUNT(*) as usuarios FROM users,
            COUNT(*) as cotas FROM quotas,
            COUNT(*) as emprestimos FROM loans
    " | column -t
    sleep 30
done
```

---

## 🎯 Conclusão

Seguindo este guia, você poderá:

- ✅ Limpar dados de forma segura e controlada
- ✅ Recuperar de falhas rapidamente
- ✅ Manter integridade do banco de dados
- ✅ Evitar perda acidental de dados importantes

**Lembre-se:** Em caso de dúvida, prefira o Nível 1 (Limpeza Segura) e sempre mantenha backups atualizados!

---

_Última atualização: $(date +%Y-%m-%d)_
_Versão: 1.0_
_Compatível: Docker + PostgreSQL 14+_
