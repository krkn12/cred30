# Como Extrair Todos os Dados do Banco CRED30

## 🎯 Objetivo

Este documento explica como extrair **TODOS os dados** do banco de dados PostgreSQL do sistema CRED30 usando os scripts criados.

## 📋 Scripts Disponíveis

### 1. Script SQL Principal

- **Arquivo**: `extract-all-data.sql`
- **Função**: Script SQL que extrai dados de todas as 25 tabelas
- **Formato**: Saída em CSV com headers

### 2. Scripts de Execução

#### Para Windows (Batch)

- **Arquivo**: `extract-all-data.bat`
- **Uso**: Clique duas vezes ou execute via CMD
- **Saída**: `database\backup\cred30_complete_backup_[TIMESTAMP].sql`

#### Para Windows (PowerShell)

- **Arquivo**: `extract-all-data.ps1`
- **Uso**: Execute via PowerShell
- **Saída**: `database\backup\cred30_complete_backup_[TIMESTAMP].sql`

#### Para Linux/Mac (Shell)

- **Arquivo**: `extract-all-data.sh`
- **Uso**: `chmod +x extract-all-data.sh && ./extract-all-data.sh`
- **Saída**: `database/backup/cred30_complete_backup_[TIMESTAMP].sql`

---

## 🚀 Como Usar

### Método 1: Windows Batch (Recomendado para Windows)

1. Abra o CMD ou PowerShell
2. Navegue até o diretório do projeto:
   ```cmd
   cd C:\Users\josia\Desktop\projetos\cred30
   ```
3. Execute o script:
   ```cmd
   scripts\database\extract-all-data.bat
   ```
4. Aguarde a conclusão

### Método 2: Windows PowerShell

1. Abra o PowerShell
2. Navegue até o diretório do projeto:
   ```powershell
   cd C:\Users\josia\Desktop\projetos\cred30
   ```
3. Execute o script:
   ```powershell
   .\scripts\database\extract-all-data.ps1
   ```
4. Aguarde a conclusão

### Método 3: Linux/Mac

1. Abra o terminal
2. Navegue até o diretório do projeto:
   ```bash
   cd /path/to/cred30
   ```
3. Dê permissão de execução:
   ```bash
   chmod +x scripts/database/extract-all-data.sh
   ```
4. Execute o script:
   ```bash
   ./scripts/database/extract-all-data.sh
   ```
5. Aguarde a conclusão

---

## 📊 O Que Será Extraído

### Tabelas Principais (5)

1. **users** - Todos os usuários do sistema
2. **quotas** - Cotas de investimento
3. **loans** - Empréstimos solicitados
4. **transactions** - Todas as transações
5. **system_config** - Configurações do sistema

### Tabelas Complementares (8)

6. **loan_installments** - Parcelas de empréstimos
7. **withdrawals** - Saques solicitados
8. **system_settings** - Configurações adicionais
9. **system_fees** - Taxas do sistema
10. **app_settings** - Configurações da aplicação
11. **daily_reports** - Relatórios diários
12. **admin_dashboard** - Métricas administrativas
13. **user_financial_summary** - Resumo financeiro

### Tabelas de Auditoria (4)

14. **audit_logs** - Logs de auditoria
15. **admin_logs** - Logs de administradores
16. **backup_logs** - Registro de backups
17. **rate_limit_logs** - Logs de limitação

### Tabelas Avançadas (8)

18. **user_sessions** - Sessões ativas
19. **notification_settings** - Preferências de notificação
20. **notifications** - Notificações do sistema
21. **user_statistics** - Estatísticas dos usuários
22. **referrals** - Sistema de indicações
23. **support_tickets** - Tickets de suporte
24. **fee_history** - Histórico de taxas
25. **current_financial_summary** (View) - Dashboard financeiro

---

## 📁 Estrutura do Arquivo Gerado

O arquivo de backup conterá:

```
=== EXTRAÇÃO COMPLETA DE DADOS - CRED30 ===
Data/Hora: [TIMESTAMP]
Banco: cred30
Usuário: cred30user
=====================================

-- 1. TABELAS DE CONFIGURAÇÃO --
-- system_config
table_name|total_records
system_config|1
[id,system_balance,profit_pool,quota_price,...]
1|0.00|0.00|50.00|...

-- system_settings
table_name|total_records
system_settings|0
[key,value,description,created_at,...]

... (continua para todas as 25 tabelas)

=== RESUMO DA EXTRAÇÃO ===
Data/Hora: [TIMESTAMP]
Total de tabelas: 25
Status: CONCLUÍDO COM SUCESSO
=====================================

-- ESTATÍSTICAS FINAIS --
table_name|total_records
users|1
quotas|0
loans|0
transactions|0
withdrawals|0
audit_logs|0
...

=== EXTRAÇÃO CONCLUÍDA ===
```

---

## ✅ Verificação Pós-Extração

### 1. Verificar o Arquivo

- Confirme se o arquivo foi criado em `database\backup\`
- Verifique o tamanho do arquivo (deve ter vários MB se houver dados)

### 2. Validar o Conteúdo

- Abra o arquivo em um editor de texto
- Verifique se os headers das tabelas estão presentes
- Confirme se há dados nas linhas

### 3. Testar Restauração (Opcional)

- Em ambiente de teste, restaure o backup:
  ```bash
  docker exec -i cred30-postgres psql -U cred30user -d cred30_teste -f backup_file.sql
  ```
- Verifique se os dados foram restaurados corretamente

---

## 🔧 Solução de Problemas

### Problema: "docker: command not found"

**Solução**: Certifique-se de que o Docker está instalado e no PATH

### Problema: "permission denied"

**Solução**:

- Windows: Execute como Administrador
- Linux/Mac: Use `sudo` ou verifique permissões

### Problema: "connection refused"

**Solução**: Verifique se o container `cred30-postgres` está rodando

### Problema: "database does not exist"

**Solução**: Confirme o nome do banco (`cred30` ou `cred30db`)

---

## 📋 Checklist de Extração

- [ ] Docker está rodando
- [ ] Container `cred30-postgres` está ativo
- [ ] Script de extração escolhido (.bat, .ps1 ou .sh)
- [ ] Diretório `database\backup` existe ou será criado
- [ ] Permissões de execução adequadas
- [ ] Espaço em disco suficiente para o backup
- [ ] Backup concluído com sucesso
- [ ] Arquivo verificado e validado
- [ ] Backup armazenado em local seguro

---

## 🎉 Conclusão

Após executar o script de extração, você terá:

- ✅ Backup completo de todas as 25 tabelas
- ✅ Dados em formato SQL legível
- ✅ Metadados sobre a extração
- ✅ Estatísticas finais
- ✅ Arquivo com timestamp para rastreamento

O sistema CRED30 estará completamente backupado e pronto para restauração quando necessário.

---

_Última atualização: 15/12/2024_
_Versão dos scripts: v1.0_
_Total de tabelas: 25_
