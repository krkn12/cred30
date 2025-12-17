# 📋 Guia Completo de Limpeza do Banco de Dados Cred30

## 🎯 Visão Geral

Este guia documenta os scripts seguros para limpeza do banco de dados do Cred30, oferecendo múltiplos níveis de segurança para diferentes cenários de uso.

## 📁 Arquivos Disponíveis

### Scripts Principais

- **`secure-database-cleanup.sh`** - Script Bash para Linux/Mac
- **`secure-database-cleanup.ps1`** - Script PowerShell para Windows
- **`test-cleanup.sh`** - Script de validação do ambiente

### Documentação

- **`README-LIMPEZA-COMPLETA.md`** - Este arquivo (guia completo)
- **`README-LIMPEZA-SEGURA.md`** - Guia de segurança e procedimentos

## 🚀 Como Usar

### Para Linux/Mac

```bash
# Tornar executável
chmod +x scripts/database/secure-database-cleanup.sh

# Executar
./scripts/database/secure-database-cleanup.sh
```

### Para Windows

```powershell
# Executar no PowerShell
.\scripts\database\secure-database-cleanup.ps1

# Ou se tiver restrição de execução:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\database\secure-database-cleanup.ps1
```

## 📊 Níveis de Limpeza Disponíveis

### 1️⃣ Limpeza Segura

- **Descrição**: Remove apenas os dados, mantém estrutura
- **Ideal para**: Limpeza regular de dados de teste
- **Preserva**:
  - ✅ Estrutura completa das tabelas
  - ✅ Usuário admin principal
  - ✅ Configurações do sistema
- **Remove**: Todos os dados de usuários, transações, empréstimos, etc.

### 2️⃣ Limpeza Completa

- **Descrição**: Recria estrutura do zero
- **Ideal para**: Reset completo mantendo admin
- **Preserva**:
  - ✅ Usuário admin principal
  - ✅ Configurações básicas
- **Remove**: Tudo e recria do zero

### 3️⃣ Reset Total

- **Descrição**: Apaga tudo e recria do zero
- **Ideal para**: Desenvolvimento completo
- **Preserva**: Apenas estrutura recriada
- **Remove**: Tudo inclusive admin

### 4️⃣ 💀 Apagar TUDO (inclusive Admin)

- **Descrição**: Remove 100% dos dados
- **Ideal para**: Reset absoluto do sistema
- **Preserva**: Apenas estrutura das tabelas
- **Remove**:
  - ❌ TODOS os usuários (inclusive admin)
  - ❌ Todos os dados
  - ❌ Sistema fica 100% vazio

## 🔒 Recursos de Segurança

### ✅ Backup Automático

- Criado antes de qualquer operação
- Salvo em `./backups/` com timestamp
- Compactado automaticamente (.gz)

### ✅ Verificação de Integridade

- Verifica estrutura das tabelas após limpeza
- Mostra contagem de registros
- Valida sequências e constraints

### ✅ Transações SQL

- Todas as operações em transações
- Rollback automático em caso de erro
- Preserva consistência do banco

### ✅ Triggers Gerenciados

- Desabilitados temporariamente durante limpeza
- Reabilitados após conclusão
- Evita conflitos de integridade

## 🛠️ Funções Adicionais

### Verificar Status

- Mostra contagem atual de todas as tabelas
- Verifica integridade da estrutura
- Identifica problemas potenciais

### Backup Apenas

- Cria backup sem modificar dados
- Útil para backups manuais
- Compactação automática

## 📋 Pré-requisitos

### Docker

- Container PostgreSQL deve estar rodando
- Nome padrão: `cred30-postgres`
- Usuário padrão: `cred30user`
- Banco padrão: `cred30`

### Permissões

- Acesso ao Docker
- Permissão de escrita no diretório `./backups/`
- Para Windows: PowerShell com permissão de execução

## 🚨 Cuidados Importantes

### Antes de Usar

1. **Sempre** faça backup manual adicional se necessário
2. **Nunca** use em produção sem testes
3. **Verifique** se está no ambiente correto
4. **Confirme** o nível de limpeza desejado

### Durante Execução

1. **Não** interrompa o processo
2. **Aguarde** conclusão completa
3. **Verifique** mensagens de erro
4. **Confirme** resultado final

### Após Limpeza

1. **Verifique** status do banco
2. **Teste** aplicação se necessário
3. **Recrie** admin se usou opção 4
4. **Documente** operação realizada

## 🔄 Recuperação de Emergência

### Se algo der errado:

1. **Pare** imediatamente o script
2. **Verifique** o backup criado automaticamente
3. **Restaure** se necessário:

   ```bash
   # Descompactar
   gunzip ./backups/cred30_backup_before_cleanup_YYYYMMDD_HHMMSS.sql.gz

   # Restaurar
   docker exec -i cred30-postgres psql -U cred30user -d cred30 < ./backups/cred30_backup_before_cleanup_YYYYMMDD_HHMMSS.sql
   ```

### Se precisar recriar admin:

```sql
INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at)
VALUES ('Administrador', 'josiassm701@gmail.com', 'admin_hash_temp', 'admin@pix.local', 'admin_secret', 'ADMIN001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

## 📞 Suporte

### Problemas Comuns

- **Container não encontrado**: Verifique se o Docker está rodando
- **Permissão negada**: Verifique permissões do Docker e diretórios
- **Erro de conexão**: Confirme nome do container e credenciais

### Logs e Debug

- Verifique logs do Docker: `docker logs cred30-postgres`
- Verifique arquivos de backup em `./backups/`
- Mensagens de erro são exibidas em vermelho

## 📝 Histórico de Alterações

### v2.0 (Atual)

- ✅ Adicionada opção de apagar tudo inclusive admin
- ✅ Melhorada validação de integridade
- ✅ Adicionado suporte completo Windows/PowerShell
- ✅ Melhorada interface e mensagens

### v1.0

- ✅ Versão inicial com 3 níveis de limpeza
- ✅ Backup automático
- ✅ Verificação de integridade

---

**⚠️ AVISO FINAL**: Use estes scripts com cuidado. Sempre teste em ambiente de desenvolvimento antes de usar em produção.
