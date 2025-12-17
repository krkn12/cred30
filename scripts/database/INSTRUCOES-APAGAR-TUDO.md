# 🗑️ Guia Rápido: Apagar Tudo (Inclusive Admin)

## 📋 Scripts Disponíveis

### Para Linux/Mac

```bash
# Script completo com menu
./scripts/database/secure-database-cleanup.sh

# Script direto para apagar tudo
./scripts/database/apagar-tudo-inclusive-admin.sh
```

### Para Windows

```powershell
# Script completo com menu
.\scripts\database\secure-database-cleanup.ps1

# Script direto para apagar tudo
.\scripts\database\apagar-tudo-inclusive-admin.ps1
```

## 🚀 Como Usar

### Opção 1: Script Completo (Recomendado)

1. Execute o script completo
2. Escolha a opção **4) 💀 Apagar TUDO (inclusive Admin)**
3. Confirme a operação
4. Aguarde conclusão

### Opção 2: Script Direto (Mais Rápido)

1. Execute o script direto de apagamento
2. Confirme a operação
3. Aguarde conclusão

## ⚠️ Antes de Executar

1. **Backup**: Os scripts criam backup automático em `./backups/`
2. **Container**: Verifique se `cred30-postgres` está rodando
3. **Ambiente**: Confirme que está no ambiente correto (desenvolvimento)
4. **Consequência**: O banco ficará 100% vazio, sem nenhum usuário

## 🔄 Após Apagar Tudo

### Para recriar o banco completo:

```bash
# Linux/Mac
docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql

# Windows (PowerShell)
docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql
```

### Para criar um novo admin manualmente:

```sql
-- Conecte ao banco
docker exec -it cred30-postgres psql -U cred30user -d cred30

-- Execute o SQL
INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at)
VALUES ('Seu Nome', 'seu@email.com', 'senha_hash', 'sua@chave.pix', 'sua_frase_secreta', 'CODIGO001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

## 📁 Arquivos Criados

### Scripts Principais

- ✅ `secure-database-cleanup.sh` - Menu completo (Linux/Mac)
- ✅ `secure-database-cleanup.ps1` - Menu completo (Windows)
- ✅ `apagar-tudo-inclusive-admin.sh` - Script direto (Linux/Mac)
- ✅ `apagar-tudo-inclusive-admin.ps1` - Script direto (Windows)

### Documentação

- ✅ `README-LIMPEZA-COMPLETA.md` - Guia completo
- ✅ `INSTRUCOES-APAGAR-TUDO.md` - Este guia rápido

### Backups

- 📁 `./backups/emergency_backup_before_wipe_YYYYMMDD_HHMMSS.sql.gz`

## 🛡️ Recursos de Segurança

### ✅ Backup Automático

- Criado antes de qualquer operação
- Nomeado com timestamp
- Compactado (.gz)

### ✅ Verificação Final

- Contagem de usuários após operação
- Confirmação de banco vazio
- Relatório detalhado

### ✅ Transações SQL

- Operações em transação
- Rollback automático em erro
- Preservação de estrutura

## 🚨 Cuidados Importantes

### ❌ NÃO FAÇA

- Não execute em produção sem testes
- Não interrompa o processo durante execução
- Não ignore mensagens de erro

### ✅ FAÇA SEMPRE

- Verifique o ambiente antes de executar
- Confirme o nível de limpeza desejado
- Aguarde conclusão completa
- Teste a aplicação após operação

## 📞 Suporte

### Problemas Comuns

- **Container não encontrado**: `docker ps` para verificar
- **Permissão negada**: Verifique permissões do Docker
- **Script não executa**: No Windows, use PowerShell

### Logs e Debug

- Logs do Docker: `docker logs cred30-postgres`
- Verifique backups em `./backups/`
- Mensagens de erro aparecem em vermelho

---

**⚠️ AVISO FINAL**: Estes scripts apagam 100% dos dados. Use com extrema cautela!
