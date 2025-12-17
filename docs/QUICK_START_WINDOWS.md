# Guia Rápido: CRED30 com ngrok Único no Windows

## 🚀 Execução Imediata (3 minutos)

### Opção 1: PowerShell (Recomendado)

```powershell
# 1. Abrir PowerShell como Administrador
# 2. Navegar para a pasta do projeto
cd C:\Users\josia\Desktop\projetos\cred30

# 3. Executar o script PowerShell
.\start-single-ngrok.ps1
```

### Opção 2: CMD (Prompt de Comando)

```cmd
# 1. Abrir CMD como Administrador
# 2. Navegar para a pasta do projeto
cd C:\Users\josia\Desktop\projetos\cred30

# 3. Executar o script batch
start-single-ngrok.bat
```

## 🔧 Se o PowerShell der erro de execução

### Habilitar scripts PowerShell:

```powershell
# Executar uma vez como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Ou para sessão atual apenas
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

## 📱 URLs Após Execução

O script irá mostrar:

```
🎉 CRED30 está online com ngrok único!
📱 Acesso Completo:
   Local: http://localhost:5173
   Externo: https://abc123.ngrok-free.app
🔧 Endpoints:
   Frontend: https://abc123.ngrok-free.app
   API: https://abc123.ngrok-free.app/api
   Dashboard Admin: https://abc123.ngrok-free.app/admin
```

## 👥 Credenciais de Teste

```
Admin:  admin@cred30.com / admin123
Cliente: joao@cred30.com / cliente123
```

## 🧪 Teste Rápido

### Testar Localmente:

```powershell
# Frontend
curl http://localhost:5173

# API via proxy
curl http://localhost:5173/api/health
```

### Testar via ngrok:

```powershell
# Substitua URL pela que apareceu no script
curl https://SEU_NGROK.ngrok-free.app
curl https://SEU_NGROK.ngrok-free.app/api/health
```

## 🛠️ Comandos Úteis

### Verificar Status:

```powershell
docker compose -f docker-compose.single-ngrok.yml ps
```

### Ver Logs:

```powershell
docker compose -f docker-compose.single-ngrok.yml logs -f
```

### Parar Tudo:

```powershell
docker compose -f docker-compose.single-ngrok.yml down
```

## 🚨 Problemas Comuns

### 1. "scripts are disabled"

```powershell
# Solução:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. "docker-compose not recognized"

```powershell
# Use o novo comando:
docker compose -f docker-compose.single-ngrok.yml up -d
```

### 3. "ngrok not found"

```powershell
# Instalar ngrok:
npm install -g ngrok
```

### 4. "Docker not running"

```powershell
# Inicie o Docker Desktop
# Ou reinicie o serviço Docker
```

## 📊 Validação

### Checklist:

- [ ] Frontend carrega em http://localhost:5173
- [ ] API responde em http://localhost:5173/api/health
- [ ] ngrok mostra URL pública
- [ ] Login admin funciona
- [ ] Dashboard cliente funciona

### Teste Automático:

```powershell
node test-single-ngrok.js
```

## 🎉 Pronto para Compartilhar!

Após executar o script:

1. **Copie a URL ngrok** que apareceu no terminal
2. **Compartilhe com usuários teste**
3. **Monitore os logs** para ver acessos
4. **Colete feedback** para melhorias

---

## 📞 Suporte Rápido

Se encontrar problemas:

1. **Verifique se Docker Desktop está rodando**
2. **Verifique se ngrok está instalado**
3. **Use PowerShell como Administrador**
4. **Verifique as portas 5173 e 3001**

Recursos:

- [Guia Completo](./NGROK_SINGLE_GUIDE.md)
- [Resumo da Solução](./SINGLE_NGROK_SUMMARY.md)
