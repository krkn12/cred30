# 🚨 INSTRUÇÕES DEFINITIVAS PARA RESOLVER PROBLEMAS NO WINDOWS

## 📋 Problemas Identificados

1. **Erro de módulo não encontrado**: `Cannot find module 'fix-ngrok-session-limit.js'`
2. **Script batch não encontrado**: `The term 'start-single-ngrok.bat' is not recognized`
3. **Limite de sessão ngrok**: `Your account is limited to 1 simultaneous ngrok agent sessions`

## ✅ SOLUÇÕES DEFINITIVAS

### 🎯 SOLUÇÃO 1: Usar PowerShell (Recomendado)

Execute o script PowerShell que resolve todos os problemas:

```powershell
# No diretório raiz do projeto (C:\Users\josia\Desktop\projetos\cred30)
.\fix-problemas-windows.ps1
```

### 🔧 SOLUÇÃO 2: Comandos Manuais (Alternativa)

Se o PowerShell não funcionar, execute estes comandos manualmente:

#### Passo 1: Matar processos ngrok existentes

```cmd
taskkill /f /im ngrok.exe
```

#### Passo 2: Limpar configuração ngrok

```cmd
rmdir /s /q "%USERPROFILE%\.ngrok2"
```

#### Passo 3: Iniciar Docker e Serviços

```cmd
docker-compose -f docker-compose.single-ngrok.yml up -d
```

#### Passo 4: Iniciar ngrok (apenas um túnel)

```cmd
ngrok http 5173 --log=stdout
```

### 🚀 SOLUÇÃO 3: Script Batch Corrigido

Crie um arquivo batch manualmente:

1. Abra o Bloco de Notas
2. Copie e cole este conteúdo:

```batch
@echo off
echo 🚀 Iniciando CRED30 com ngrok unico...

REM Verificar Docker
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker não está rodando. Inicie o Docker Desktop.
    pause
    exit /b 1
)

REM Parar containers existentes
echo 🛑 Parando containers existentes...
docker-compose -f docker-compose.single-ngrok.yml down --remove-orphans

REM Matar processos ngrok
echo 🛑 Matando processos ngrok...
taskkill /f /im ngrok.exe 2>nul

REM Limpar config ngrok
echo 🧹 Limpando configuracao ngrok...
rmdir /s /q "%USERPROFILE%\.ngrok2" 2>nul

REM Iniciar containers
echo 🐳 Iniciando containers...
docker-compose -f docker-compose.single-ngrok.yml up -d

REM Aguardar serviços
echo ⏳ Aguardando serviços iniciarem...
timeout /t 30 /nobreak >nul

REM Iniciar ngrok
echo 🌐 Iniciando ngrok...
start "Ngrok CRED30" cmd /k "ngrok http 5173 --log=stdout"

echo.
echo 🎉 CRED30 está online!
echo    Frontend: http://localhost:5173
echo    Aguarde URL ngrok na janela do Ngrok CRED30
echo.
pause
```

3. Salve como `iniciar-cred30.bat` na raiz do projeto
4. Execute: `iniciar-cred30.bat`

## 🔍 VERIFICAÇÃO DE FUNCIONAMENTO

### Teste 1: Verificar Docker

```cmd
docker-compose -f docker-compose.single-ngrok.yml ps
```

### Teste 2: Verificar Frontend Local

```cmd
curl http://localhost:5173
```

### Teste 3: Verificar API via Proxy

```cmd
curl http://localhost:5173/api/health
```

## 🛠️ SOLUÇÃO DE PROBLEMAS ESPECÍFICOS

### Problema: Script clear-expired-tokens

Use o script corrigido:

```cmd
cd backend
node clear-expired-tokens-fixed.js
```

### Problema: Conexão PostgreSQL

Teste conexão direta:

```cmd
cd backend
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});
pool.query('SELECT NOW()').then(result => {
  console.log('✅ PostgreSQL funcionando:', result.rows[0]);
  pool.end();
}).catch(console.error);
"
```

### Problema: Portas em Uso

Verifique e libere portas:

```cmd
netstat -ano | findstr :5173
netstat -ano | findstr :3001
netstat -ano | findstr :5432
```

## 📱 ACESSO APLICATIVO

Após seguir os passos corretamente:

1. **Frontend Local**: http://localhost:5173
2. **API Local**: http://localhost:5173/api
3. **Acesso Externo**: URL fornecida pelo ngrok (apenas uma)

### URLs de Exemplo

```
Frontend:    https://abc123.ngrok-free.app
API:         https://abc123.ngrok-free.app/api
Dashboard:    https://abc123.ngrok-free.app/admin
```

## 🎯 CHECKLIST FINAL

- [ ] Docker Desktop está rodando
- [ ] Apenas uma instância ngrok ativa
- [ ] Usar `docker-compose.single-ngrok.yml`
- [ ] Portas 5173, 3001, 5432 livres
- [ ] PostgreSQL acessível
- [ ] Frontend carregando em localhost:5173

## 🚨 IMPORTANTE

1. **MANTENHA APENAS UMA INSTÂNCIA NGROK** por vez
2. **USE O SCRIPT POWERSHELL** para solução automática
3. **VERIFIQUE O DOCKER** antes de iniciar os serviços
4. **AGUARDE 30 SEGUNDOS** após iniciar os containers
5. **COMPARTILHE APENAS UMA URL** ngrok com usuários

## 📞 SUPORTE RÁPIDO

Se ainda tiver problemas:

1. **Reinicie tudo**:

   ```cmd
   docker-compose -f docker-compose.single-ngrok.yml down -v
   docker system prune -f
   ```

2. **Verifique logs completos**:

   ```cmd
   docker-compose -f docker-compose.single-ngrok.yml logs
   ```

3. **Use o PowerShell com privilégios de administrador**

## 🎉 SUCESSO!

Após seguir estas instruções, você terá:

- ✅ Sistema Cred30 funcionando localmente
- ✅ Acesso externo via ngrok (uma única URL)
- ✅ Frontend e API acessíveis
- ✅ Sem erros de módulo ou sessão

A plataforma estará pronta para testes com usuários reais!
