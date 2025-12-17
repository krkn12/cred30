# Configuração do MongoDB Atlas

Este guia explica como configurar corretamente a conexão com o MongoDB Atlas para o backend da aplicação Cred30.

## Passos para configurar o MongoDB Atlas

1. **Acesse o MongoDB Atlas**
   - Vá para [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Faça login com sua conta

2. **Crie um cluster (se ainda não tiver um)**
   - Clique em "Create a Cluster"
   - Escolha o plano gratuito (M0 Sandbox)
   - Configure as opções de região e nome do cluster
   - Crie o cluster

3. **Crie um usuário do banco de dados**
   - Vá para "Database Access" no menu lateral
   - Clique em "Add New Database User"
   - Defina um nome de usuário (ex: `josiassm701`)
   - Defina uma senha segura
   - Anote a senha, você precisará dela para a conexão

4. **Configure o acesso à rede**
   - Vá para "Network Access" no menu lateral
   - Clique em "Add IP Address"
   - Para desenvolvimento, você pode permitir o acesso de qualquer IP (0.0.0.0/0)
   - Para produção, adicione apenas o IP do seu servidor

5. **Obtenha a string de conexão**
   - Vá para "Clusters" no menu lateral
   - Clique em "Connect" para o seu cluster
   - Selecione "Connect your application"
   - Escolha o driver "Node.js" e a versão mais recente
   - Copie a string de conexão

6. **Atualize o arquivo .env**
   - No arquivo `backend/.env`, substitua a linha:
     ```
     MONGODB_URI=mongodb+srv://josiassm701:<SENHA_DO_USUARIO>@cluster0.qwnh0zf.mongodb.net/?appName=Cluster0
     ```
   - Pela string de conexão que você copiou, substituindo `<password>` pela senha real do usuário que você criou

## Exemplo de configuração

```
MONGODB_URI=mongodb+srv://josiassm701:SUA_SENHA_AQUI@cluster0.qwnh0zf.mongodb.net/?retryWrites=true&w=majority
```

## Testar a conexão

Após configurar a string de conexão corretamente, execute o servidor backend:

```bash
cd backend
bun run dev
```

Se a conexão for bem-sucedida, você verá a mensagem:

```
Conectado ao MongoDB Atlas com sucesso!
Servidor rodando na porta 3001
```

## Solução de problemas

### Erro: "bad auth : authentication failed"

Isso geralmente significa que a senha no URI de conexão está incorreta. Verifique:

1. Se a senha está correta
2. Se o usuário existe no banco de dados
3. Se o usuário tem permissão para acessar o banco de dados

### Erro: "ENOTFOUND" ou similar

Isso indica um problema de DNS ou rede. Verifique:

1. Se a string de conexão está correta
2. Se seu computador tem acesso à internet
3. Se não há firewall bloqueando a conexão

### Erro: "IP whitelist"

Isso significa que o IP do seu computador não está na lista de permissões do MongoDB Atlas. Adicione seu IP à lista de permissões no painel do Atlas.
