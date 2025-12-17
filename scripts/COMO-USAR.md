# Como Usar o Ngrok Monitor - Guia Rápido

## 🎯 Problema que Resolve

Ngrok muda de URL toda vez que inicia → Quebra frontend/backend

## 🛠️ Solução

Script automático que detecta mudanças e atualiza arquivos .env

---

## 🚀 PASSO A PASSO

### 1️⃣ Teste se o Ngrok está funcionando

```bash
./scripts/test-ngrok-detection.sh
```

Se der erro, inicie o Ngrok primeiro:

```bash
ngrok http 3001
```

### 2️⃣ Configure tudo (só uma vez)

```bash
./scripts/setup-ngrok-monitor.sh
```

### 3️⃣ Inicie o monitor

```bash
./scripts/ngrok-url-monitor.sh
```

---

## ✅ O que acontece depois

- **Monitor fica rodando** verificando Ngrok a cada 5 segundos
- **Se URL mudar**, atualiza automaticamente:
  - `packages/backend/.env` → `PUBLIC_TUNNEL_URL=https://nova-url.ngrok.app`
  - `packages/frontend/.env.local` → `VITE_API_URL=https://nova-url.ngrok.app/api`
- **Logs salvos** em `ngrok-monitor.log`

---

## 🔧 Se não funcionar

### Problema: "Ngrok não encontrado"

```bash
# Verifique se Ngrok está rodando
curl http://127.0.0.1:4040/api/tunnels

# Se não responder, inicie Ngrok
ngrok http 3001
```

### Problema: "Diretório não encontrado"

```bash
# Crie os diretórios manualmente
mkdir -p packages/backend
mkdir -p packages/frontend
```

### Problema: "curl não encontrado"

- **Windows**: Instale Git for Windows
- **Linux**: `sudo apt-get install curl`

### Problema: Permissões negadas

```bash
# No Git Bash/WSL
chmod +x scripts/*.sh

# No Windows, execute como Administrador
```

---

## 📱 No Windows (Git Bash)

1. Abra **Git Bash**
2. Navegue até o projeto:
   ```bash
   cd /c/Users/josia/Desktop/projetos/cred30
   ```
3. Siga os passos acima

---

## 🎉 Resultado Final

**Antes:** Você editava arquivos .env manualmente toda vez
**Depois:** Script faz tudo automaticamente, você só desenvolve!

---

## 🆘 Ajuda

Se ainda não funcionar:

1. Execute o teste: `./scripts/test-ngrok-detection.sh`
2. Verifique os logs: `cat ngrok-monitor.log`
3. Me diga qual erro apareceu

**É isso! 🚀**
