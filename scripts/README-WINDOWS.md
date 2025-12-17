# Ngrok URL Monitor - Instruções para Windows

## Execução no Windows

Como estamos no ambiente Windows, existem algumas maneiras de executar os scripts shell:

### 1. Usando Git Bash (Recomendado)

Se você tem Git for Windows instalado:

```bash
# Abra o Git Bash e navegue até o diretório do projeto
cd /c/Users/josia/Desktop/projetos/cred30

# Execute o script de setup
./scripts/setup-ngrok-monitor.sh

# Execute o monitor diretamente
./scripts/ngrok-url-monitor.sh
```

### 2. Usando WSL (Windows Subsystem for Linux)

Se você tem WSL instalado:

```bash
# Abra o WSL e navegue até o diretório do projeto
cd /mnt/c/Users/josia/Desktop/projetos/cred30

# Execute os scripts
bash scripts/setup-ngrok-monitor.sh
bash scripts/ngrok-url-monitor.sh
```

### 3. Usando PowerShell com WSL

```powershell
# No PowerShell
wsl bash /mnt/c/Users/josia/Desktop/projetos/cred30/scripts/setup-ngrok-monitor.sh
wsl bash /mnt/c/Users/josia/Desktop/projetos/cred30/scripts/ngrok-url-monitor.sh
```

### 4. Convertendo para Batch (.bat)

Se preferir scripts nativos do Windows, você pode criar uma versão em batch:

```batch
@echo off
echo Ngrok URL Monitor para Windows
echo.

REM Verifica se o curl está disponível
curl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: curl nao esta instalado ou nao esta no PATH
    echo Instale Git for Windows ou adicione curl ao PATH
    pause
    exit /b 1
)

REM Loop infinito
:loop
echo Verificando URL do Ngrok...

REM Obtém a URL do Ngrok
for /f "tokens=*" %%i in ('curl -s http://127.0.0.1:4040/api/tunnels ^| findstr "https://"') do (
    set NGROK_URL=%%i
)

REM Processa a URL (simplificado)
if defined NGROK_URL (
    echo URL encontrada: %NGROK_URL%

    REM Atualiza arquivos .env (implementar conforme necessário)
    echo Atualizando configuracoes...

    REM Aguarda 5 segundos
    timeout /t 5 /nobreak >nul
) else (
    echo Ngrok nao encontrado ou sem tuneis ativos
    timeout /t 5 /nobreak >nul
)

goto loop
```

## Pré-requisitos para Windows

### Git for Windows (Recomendado)

1. Baixe e instale: https://git-scm.com/download/win
2. Durante a instalação, escolha "Use Git and optional Unix tools from the Command Prompt"
3. Isso incluirá curl e outras ferramentas Unix no PATH do Windows

### WSL (Alternativa)

1. Instale WSL: `wsl --install`
2. Escolha uma distribuição Linux (Ubuntu recomendado)
3. Instale curl se necessário: `sudo apt-get install curl`

### Instalação Manual do curl

1. Baixe curl para Windows: https://curl.se/windows/
2. Extraia para uma pasta (ex: `C:\curl`)
3. Adicione `C:\curl` ao PATH do Windows

## Configuração do Ngrok no Windows

1. Baixe Ngrok: https://ngrok.com/download
2. Extraia para uma pasta (ex: `C:\ngrok`)
3. Adicione `C:\ngrok` ao PATH do Windows
4. Autentique: `ngrok authtoken SEU_TOKEN`

## Execução em Background no Windows

### Usando PowerShell

```powershell
# Inicia em background
Start-Process powershell -ArgumentList "-Command", "bash ./scripts/ngrok-url-monitor.sh" -WindowStyle Hidden

# Para parar, use o Gerenciador de Tarefas ou:
Get-Process | Where-Object {$_.ProcessName -eq "powershell"} | Stop-Process
```

### Usando Windows Task Scheduler

1. Abra "Task Scheduler"
2. Create Basic Task
3. Trigger: "When the computer starts"
4. Action: "Start a program"
5. Program: `bash`
6. Arguments: `/c/Users/josia/Desktop/projetos/cred30/scripts/ngrok-url-monitor.sh`
7. Marque "Run with highest privileges"

## Solução de Problemas no Windows

### "bash não é reconhecido"

- Instale Git for Windows ou WSL
- Adicione Git\bin ao PATH do Windows

### "curl não é reconhecido"

- Instale Git for Windows (inclui curl)
- Ou instale curl separadamente

### Permissões negadas

- Execute como Administrador
- Ou ajuste as permissões dos arquivos

### Problemas com PATH

- Verifique se Git\bin está no PATH
- Reinicie o terminal após alterar PATH

## Integração com VS Code

No VS Code, você pode configurar o terminal integrado para usar bash:

1. Ctrl+Shift+P → "Terminal: Select Default Profile"
2. Escolha "Git Bash"
3. Ou configure em settings.json:

```json
{
  "terminal.integrated.defaultProfile.windows": "Git Bash"
}
```

## Resumo Rápido

1. **Instale Git for Windows** (recomendado)
2. **Abra Git Bash** no diretório do projeto
3. **Execute**: `./scripts/setup-ngrok-monitor.sh`
4. **Inicie Ngrok**: `ngrok http 3001`
5. **Execute o monitor**: `./scripts/ngrok-url-monitor.sh`

Isso é tudo! O monitor irá rodar continuamente e atualizar automaticamente suas configurações.
