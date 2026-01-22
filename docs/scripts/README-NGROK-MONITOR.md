# Ngrok URL Monitor

## Descrição

O **Ngrok URL Monitor** é um script shell robusto e automatizado que monitora continuamente as URLs públicas do Ngrok e atualiza automaticamente os arquivos de configuração do frontend e backend sempre que uma mudança é detectada.

## Problema Resolvido

O Ngrok atribui uma nova URL pública cada vez que uma sessão é iniciada, o que quebra endpoints de API e configurações de webhook que estão hardcoded nos serviços de backend e frontend, exigindo intervenção manual e interrompendo o fluxo de desenvolvimento.

## Funcionalidades

- ✅ **Monitoramento Contínuo**: Polling contínuo da API do Ngrok (`http://127.0.0.1:4040/api/tunnels`)
- ✅ **Detecção de Mudanças**: Compara a URL atual com a última conhecida para acionar atualizações apenas quando necessário
- ✅ **Atualização Automática**: Modifica automaticamente os arquivos `.env` do backend e frontend
- ✅ **Configurável**: Todas as variáveis críticas são facilmente personalizáveis no topo do script
- ✅ **Robusto**: Tratamento completo de erros e logging detalhado
- ✅ **Cross-Platform**: Funciona em Linux, macOS e Windows (com WSL ou Git Bash)

## Estrutura do Projeto

```
cred30/
├── packages/
│   ├── backend/
│   │   └── .env                    # Criado/atualizado automaticamente
│   └── frontend/
│       └── .env.local              # Criado/atualizado automaticamente
├── scripts/
│   ├── ngrok-url-monitor.sh        # Script principal
│   └── README-NGROK-MONITOR.md    # Este arquivo
└── .last_ngrok_url                # Armazena última URL conhecida
```

## Pré-requisitos

### Obrigatórios

- **curl** (para comunicação com a API do Ngrok)
- **Ngrok** rodando em `http://127.0.0.1:4040`

### Opcionais

- **jq** (para parsing JSON mais robusto)
- **bash** (versão 4.0+)

### Instalação do curl

```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install curl

# CentOS/RHEL
sudo yum install curl

# macOS
brew install curl

# Windows (com Chocolatey)
choco install curl
```

## Configuração

### 1. Personalizar Variáveis

Edite o arquivo `scripts/ngrok-url-monitor.sh` e ajuste as variáveis na seção **"CONFIGURAÇÕES USUÁRIO"**:

```bash
# URL da API do Ngrok (geralmente não precisa mudar)
NGROK_API_URL="http://127.0.0.1:4040/api/tunnels"

# Intervalo de verificação em segundos
POLLING_INTERVAL=5

# Diretórios do projeto (ajuste conforme sua estrutura)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/packages/backend"
FRONTEND_DIR="$PROJECT_ROOT/packages/frontend"

# Arquivos de configuração
BACKEND_ENV_FILE="$BACKEND_DIR/.env"
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"

# Variáveis de ambiente a serem atualizadas
BACKEND_TUNNEL_VAR="PUBLIC_TUNNEL_URL"
FRONTEND_API_VAR="VITE_API_URL"

# Sufixo para API endpoints
API_ENDPOINT_SUFFIX="/api"
```

### 2. Tornar o Script Executável

```bash
chmod +x scripts/ngrok-url-monitor.sh
```

## Uso

### Execução Interativa (Primeiro Plano)

```bash
# A partir do diretório raiz do projeto
./scripts/ngrok-url-monitor.sh
```

### Execução em Background

```bash
# Linux/macOS
nohup ./scripts/ngrok-url-monitor.sh > /dev/null 2>&1 &

# Ou com screen/tmux
screen -S ngrok-monitor
./scripts/ngrok-url-monitor.sh
# Ctrl+A+D para detach

# Ou com systemd (serviço)
sudo cp scripts/ngrok-monitor.service /etc/systemd/system/
sudo systemctl enable ngrok-monitor
sudo systemctl start ngrok-monitor
```

### Execução no Windows

```bash
# Com Git Bash
./scripts/ngrok-url-monitor.sh

# Com WSL
wsl bash ./scripts/ngrok-url-monitor.sh

# Com PowerShell (requer adaptação)
```

## Fluxo de Funcionamento

1. **Inicialização**: O script verifica pré-requisitos e configura o ambiente
2. **Loop Infinito**: Inicia monitoramento contínuo com intervalo configurável
3. **Verificação Ngrok**: Confirma se o Ngrok está acessível via API
4. **Obtenção URL**: Busca a URL HTTPS atual do Ngrok
5. **Comparação**: Compara com a última URL conhecida
6. **Atualização**: Se houver mudança, atualiza os arquivos de configuração
7. **Logging**: Registra todas as operações com timestamp
8. **Repetição**: Aguarda o próximo ciclo de verificação

## Arquivos Gerados

### Backend (.env)

```bash
# packages/backend/.env
PUBLIC_TUNNEL_URL=https://abc123.ngrok-free.app
```

### Frontend (.env.local)

```bash
# packages/frontend/.env.local
VITE_API_URL=https://abc123.ngrok-free.app/api
```

### Log de Atividades

```bash
# ngrok-monitor.log
[2024-01-15 10:30:00] INFO: Iniciando monitoramento do Ngrok...
[2024-01-15 10:30:05] INFO: URL do Ngrok inalterada: https://abc123.ngrok-free.app
[2024-01-15 10:35:12] INFO: URL do Ngrok alterada!
[2024-01-15 10:35:12] INFO: URL anterior: https://abc123.ngrok-free.app
[2024-01-15 10:35:12] INFO: URL atual: https://def456.ngrok-free.app
[2024-01-15 10:35:12] INFO: Atualizando configuração do backend...
[2024-01-15 10:35:12] SUCCESS: Configuração do backend atualizada com sucesso
[2024-01-15 10:35:12] INFO: Atualizando configuração do frontend...
[2024-01-15 10:35:12] SUCCESS: Configuração do frontend atualizada com sucesso: https://def456.ngrok-free.app/api
[2024-01-15 10:35:12] SUCCESS: Configurações atualizadas com sucesso!
```

## Solução de Problemas

### Ngrok não detectado

**Erro**: `ERROR: Ngrok não está rodando ou não foi possível conectar à API`

**Soluções**:

1. Verifique se o Ngrok está rodando: `ngrok http 3001`
2. Confirme a porta da API: `curl http://127.0.0.1:4040/api/tunnels`
3. Ajuste a variável `NGROK_API_URL` no script

### Arquivos .env não criados

**Erro**: `ERROR: Diretório do backend não encontrado`

**Soluções**:

1. Verifique os caminhos em `BACKEND_DIR` e `FRONTEND_DIR`
2. Crie os diretórios manualmente se necessário
3. Ajuste as variáveis conforme sua estrutura

### Permissões negadas

**Erro**: `Permission denied`

**Soluções**:

1. Torne o script executável: `chmod +x scripts/ngrok-url-monitor.sh`
2. Verifique permissões dos diretórios
3. Execute como usuário adequado

### curl não encontrado

**Erro**: `ERROR: curl não está instalado`

**Soluções**: Instale curl conforme instruções na seção de pré-requisitos

## Integração com Workflow de Desenvolvimento

### 1. Inicialização Automática

Adicione ao seu `package.json`:

```json
{
  "scripts": {
    "dev:ngrok": "ngrok http 3001 &",
    "dev:monitor": "./scripts/ngrok-url-monitor.sh &",
    "dev": "npm run dev:ngrok && npm run dev:monitor && npm run dev:services"
  }
}
```

### 2. Docker Integration

Para uso com Docker Compose:

```yaml
version: "3.8"
services:
  ngrok-monitor:
    build: .
    volumes:
      - ./packages:/app/packages
      - ./scripts:/app/scripts
    command: bash /app/scripts/ngrok-url-monitor.sh
    depends_on:
      - backend
      - ngrok
```

### 3. IDE Integration

**VS Code**: Adicione ao `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Ngrok Monitor",
      "type": "shell",
      "command": "./scripts/ngrok-url-monitor.sh",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ]
}
```

## Monitoramento e Manutenção

### Verificar Status

```bash
# Verificar se está rodando
ps aux | grep ngrok-url-monitor

# Verificar logs
tail -f ngrok-monitor.log

# Verificar última URL
cat .last_ngrok_url
```

### Parar Execução

```bash
# Se rodando em foreground
Ctrl+C

# Se rodando em background
kill $(pgrep -f ngrok-url-monitor)

# Se rodando como serviço
sudo systemctl stop ngrok-monitor
```

## Contribuições e Melhorias

### Possíveis Melhorias Futuras

1. **Interface Web**: Dashboard para monitoramento visual
2. **Notificações**: Integração com Slack/Discord para alertas
3. **Múltiplos Túneis**: Suporte para vários túneis simultâneos
4. **Configuração JSON**: Arquivo de configuração externo
5. **Health Checks**: Verificação de saúde dos serviços

### Contribuindo

1. Fork o projeto
2. Crie uma branch de feature: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -am 'Adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a MIT License - veja o arquivo LICENSE para detalhes.

## Suporte

Para dúvidas e problemas:

1. Verifique a seção de Solução de Problemas
2. Consulte o arquivo de log: `ngrok-monitor.log`
3. Abra uma issue no repositório do projeto

---

**Desenvolvido por Senior DevOps Automation Specialist**
