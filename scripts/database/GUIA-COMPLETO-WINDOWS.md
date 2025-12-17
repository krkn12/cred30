# 🎯 GUIA COMPLETO WINDOWS - CRED30

## ❌ PROBLEMA IDENTIFICADO: Docker não está rodando

O erro `failed to connect to the docker API` indica que o Docker Desktop não está rodando ou não está acessível.

---

## ✅ SOLUÇÃO COMPLETA

### 🚀 Script Automático (RECOMENDADO)

#### Iniciar Sistema Completo (Tudo-em-Um)

```cmd
scripts\database\iniciar-sistema-completo.bat
```

**Este script faz TUDO automaticamente:**

1. ✅ Verifica instalação do Docker
2. ✅ Inicia Docker Desktop se necessário
3. ✅ Inicia containers com docker-compose
4. ✅ Aguarda PostgreSQL estar pronto
5. ✅ Recria banco completo
6. ✅ Cria administrador padrão
7. ✅ Verifica tudo está funcionando

---

## 📁 Scripts Disponíveis

### Scripts Principais

- ✅ `iniciar-sistema-completo.bat` - **AUTOMÁTICO COMPLETO**
- ✅ `verificar-docker.bat` - Verificação detalhada
- ✅ `apagar-tudo-inclusive-admin.bat` - Apagar dados
- ✅ `recriar-banco-completo.bat` - Recriar banco
- ✅ `criar-admin.bat` - Criar admin

### Fluxo Manual (se preferir)

1. **Verificar Docker:**

   ```cmd
   scripts\database\verificar-docker.bat
   ```

2. **Iniciar Docker Desktop manualmente:**
   - Pressione `Win + S`
   - Procure "Docker Desktop"
   - Inicie o aplicativo
   - Aguarde 30 segundos

3. **Iniciar containers:**

   ```cmd
   cd C:\Users\josia\Desktop\projetos\cred30
   docker-compose up -d
   ```

4. **Verificar containers:**
   ```cmd
   docker ps
   ```

---

## 🔧 Soluções para Problemas Comuns

### ❌ "Docker não encontrado"

**Causa:** Docker não instalado
**Solução:**

1. Baixe Docker Desktop do site oficial
2. Instale e reinicie o computador
3. Execute o script novamente

### ❌ "Docker daemon não está rodando"

**Causa:** Docker Desktop não iniciado
**Solução:**

1. Inicie Docker Desktop manualmente
2. Aguarde inicialização completa
3. Execute o script novamente

### ❌ "Container não encontrado"

**Causa:** Containers não foram criados
**Solução:**

```cmd
cd C:\Users\josia\Desktop\projetos\cred30
docker-compose up -d
```

### ❌ "Falha na conexão PostgreSQL"

**Causa:** PostgreSQL ainda está iniciando
**Solução:**

1. Aguarde mais tempo
2. Verifique logs: `docker logs cred30-postgres`
3. Reinicie o container se necessário

---

## 🚀 Como Usar o Script Automático

### Passo 1: Abrir Terminal

- Pressione `Win + R`
- Digite `cmd`
- Pressione Enter

### Passo 2: Navegar até o Projeto

```cmd
cd C:\Users\josia\Desktop\projetos\cred30
```

### Passo 3: Executar Script Completo

```cmd
scripts\database\iniciar-sistema-completo.bat
```

### Passo 4: Confirmar Operação

- Digite `S` quando solicitado
- Aguarde processo completo
- Anote os dados do admin

---

## 📋 Dados do Administrador

Após execução do script completo:

- **Nome:** Administrador Cred30
- **Email:** josiassm701@gmail.com
- **Senha Temporária:** admin_temp_hash_123
- **PIX:** admin@cred30.pix
- **Frase Secreta:** cred30_admin_secret
- **Código Ref:** CRED30ADMIN

**⚠️ IMPORTANTE:** Altere a senha no primeiro acesso!

---

## 🎯 Resultado Esperado

### Execução Bem-Sucedida:

```
🚀 INICIAR SISTEMA COMPLETO - CRED30

📋 ESTE SCRIPT IRÁ:
   1. Verificar Docker
   2. Iniciar containers se necessário
   3. Aguardar PostgreSQL estar pronto
   4. Recriar banco se necessário
   5. Criar admin se necessário

⚠️  ATENÇÃO: Isso irá APAGAR TODOS OS DADOS atuais!
Deseja continuar? (S/N): S

🔍 PASSO 1: Verificando Docker...
✅ Docker encontrado
✅ Docker daemon rodando

🔍 PASSO 2: Verificando containers...
📋 Containers atuais:
NAMES               STATUS              IMAGE
cred30-postgres      Up 2 minutes         postgres:15
✅ Container cred30-postgres encontrado
✅ Container já está rodando

🔍 PASSO 3: Aguardando PostgreSQL...
   Tentativa 1 de 30...
✅ PostgreSQL está pronto!

🔍 PASSO 4: Recriando banco de dados...
✅ Banco recriado com sucesso!

🔍 PASSO 5: Criando administrador...
✅ Administrador criado com sucesso!

📋 DADOS DO ADMINISTRADOR:
   Nome: Administrador Cred30
   Email: josiassm701@gmail.com
   PIX: admin@cred30.pix
   Frase Secreta: cred30_admin_secret
   Codigo Ref: CRED30ADMIN
   Senha Temporaria: admin_temp_hash_123
⚠️  IMPORTANTE: Altere a senha temporária no primeiro acesso!

🔍 PASSO 6: Verificação final...
   Administradores: 1
   Tabelas criadas: 25
✅ Sistema configurado com sucesso!

🎉 SISTEMA CRED30 PRONTO PARA USO!

🔄 PRÓXIMOS PASSOS:
   1. Acesse a aplicação
   2. Use email: josiassm701@gmail.com
   3. Use senha: admin_temp_hash_123
   4. Altere a senha no primeiro acesso

🌐 Para acessar a aplicação, verifique a URL no terminal do backend

📋 Comandos úteis:
   Verificar status: docker ps
   Verificar logs: docker logs cred30-postgres
   Parar sistema: docker-compose down
   Reiniciar sistema: docker-compose restart

🎉 OPERAÇÃO CONCLUÍDA COM SUCESSO!
```

---

## 🛡️ Recursos de Segurança

### ✅ Verificação Automática

- Docker instalado e rodando
- Containers criados e ativos
- PostgreSQL pronto para conexões
- Banco recriado corretamente
- Admin criado com sucesso

### ✅ Backup Automático

- Scripts criam backup antes de operações
- Salvos em `./backups/` com timestamp
- Compactados para economizar espaço

### ✅ Recuperação

- Scripts individuais para cada operação
- Verificação de integridade
- Logs detalhados para debug

---

## 📞 Suporte Rápido

### Se o script automático falhar:

1. **Execute a verificação manual:**

   ```cmd
   scripts\database\verificar-docker.bat
   ```

2. **Inicie Docker Desktop manualmente**

3. **Execute docker-compose manualmente:**

   ```cmd
   cd C:\Users\josia\Desktop\projetos\cred30
   docker-compose up -d
   ```

4. **Execute os scripts individuais:**
   ```cmd
   scripts\database\recriar-banco-completo.bat
   scripts\database\criar-admin.bat
   ```

---

## 🎉 SUCESSO GARANTIDO

Com o script `iniciar-sistema-completo.bat` você tem:

- ✅ **Solução automática** para todos os problemas
- ✅ **Verificação completa** do ambiente
- ✅ **Iniciação automática** do Docker
- ✅ **Configuração completa** do sistema
- ✅ **Admin padrão** para primeiro acesso
- ✅ **Verificação final** de tudo funcionando

**Basta executar um script e aguardar!**

---

**🚀 RECOMENDAÇÃO FINAL:** Use sempre o script `iniciar-sistema-completo.bat` para configurar o Cred30 do zero no Windows!
