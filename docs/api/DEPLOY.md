# Deploy do Backend Cred30

Este guia explica como implantar o backend Cred30 em uma VPS com Bun e MongoDB Atlas.

## Pré-requisitos

- VPS com acesso SSH (mínimo 1GB RAM, 1 CPU)
- Conta no MongoDB Atlas
- Node.js (para instalar o Bun)

## 1. Instalar o Bun

Conecte-se à sua VPS via SSH e instale o Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

Após a instalação, feche e abra novamente a sessão SSH ou execute:
```bash
source ~/.bashrc
```

## 2. Configurar o Projeto

Clone o repositório e acesse o diretório:

```bash
git clone https://github.com/seu-usuario/cred30.git
cd cred30/backend
```

Instale as dependências:
```bash
bun install
```

## 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e configure as variáveis:

```bash
cp .env.example .env
nano .env
```

Configure as seguintes variáveis:

```
# Configuração do MongoDB Atlas
MONGODB_URI=mongodb+srv://<usuario>:<senha>@cluster0.xxxxx.mongodb.net/cred30?retryWrites=true&w=majority

# Configuração do JWT
JWT_SECRET=uma_chave_muito_longa_e_segura_aqui

# Configuração do Servidor
PORT=3001

# Configuração da API Gemini (opcional)
GEMINI_API_KEY=sua_chave_api_gemini

# Configurações do Sistema
QUOTA_PRICE=50
LOAN_INTEREST_RATE=0.2
PENALTY_RATE=0.4
VESTING_PERIOD_DAYS=365
ADMIN_PIX_KEY=91980177874
```

## 4. Configurar o MongoDB Atlas

1. Crie um cluster no MongoDB Atlas (tier gratuito M0 é suficiente para começar)
2. Crie um banco de dados chamado `cred30`
3. Crie um usuário com permissões de leitura/escrita
4. Configure o acesso à rede (permitir acesso de qualquer IP para desenvolvimento)
5. Copie a string de conexão e cole no `.env`

## 5. Build da Aplicação

```bash
bun run build
```

## 6. Instalar PM2 para Gerenciamento de Processo

Instale o PM2 globalmente:

```bash
npm install -g pm2
```

## 7. Iniciar a Aplicação

Inicie a aplicação com PM2:

```bash
pm2 start dist/index.js --name "cred30-backend"
```

Verifique o status:
```bash
pm2 status
```

Visualize os logs:
```bash
pm2 logs cred30-backend
```

## 8. Configurar Firewall

Se necessário, abra a porta 3001 no firewall:

```bash
# Para sistemas com UFW (Ubuntu)
sudo ufw allow 3001

# Para sistemas com firewalld (CentOS)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

## 9. Configurar Nginx como Proxy Reverso (Opcional)

Se você quiser usar um domínio e HTTPS, configure o Nginx:

Instale o Nginx:
```bash
sudo apt update
sudo apt install nginx
```

Crie um arquivo de configuração:
```bash
sudo nano /etc/nginx/sites-available/cred30-api
```

Adicione o seguinte conteúdo:
```nginx
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Habilite o site:
```bash
sudo ln -s /etc/nginx/sites-available/cred30-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 10. Configurar SSL com Let's Encrypt (Opcional)

Instale o Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
```

Obtenha e instale o certificado:
```bash
sudo certbot --nginx -d api.seudominio.com
```

## 11. Atualizar a Aplicação

Para atualizar a aplicação após fazer mudanças:

```bash
git pull origin main
bun install
bun run build
pm2 restart cred30-backend
```

## 12. Monitoramento

Monitore a aplicação com PM2:

```bash
# Verificar status
pm2 status

# Verificar logs
pm2 logs cred30-backend

# Reiniciar aplicação
pm2 restart cred30-backend

# Parar aplicação
pm2 stop cred30-backend

# Remover aplicação do PM2
pm2 delete cred30-backend
```

## Solução de Problemas

### Problemas Comuns

1. **Erro de conexão com MongoDB**
   - Verifique a string de conexão no `.env`
   - Certifique-se de que o IP da VPS está autorizado no Atlas
   - Verifique as credenciais do banco de dados

2. **Porta já em uso**
   - Verifique se a porta 3001 não está sendo usada por outro processo
   - Use `sudo lsof -i :3001` para verificar

3. **Erros de permissão**
   - Verifique as permissões dos arquivos
   - Certifique-se de que o usuário tem permissão para executar o Bun

4. **Aplicação cai após fechar SSH**
   - Use o PM2 para manter a aplicação rodando em segundo plano
   - Configure o PM2 para iniciar com o sistema: `pm2 startup`

### Escalabilidade

Para escalar a aplicação:

1. **Aumentar recursos da VPS**
   - Mais RAM e CPU conforme necessário
   - Monitorar uso de recursos com `htop`

2. **Configurar cluster MongoDB**
   - Migre para um tier superior no Atlas se necessário
   - Configure índices apropriados para consultas frequentes

3. **Balanceamento de carga**
   - Configure múltiplas instâncias com PM2
   - Use Nginx como balanceador de carga

```bash
# Iniciar múltiplas instâncias
pm2 start dist/index.js -i max --name "cred30-backend-cluster"