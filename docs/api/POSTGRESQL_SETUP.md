# Configuração do PostgreSQL Local

Este guia explica como configurar o PostgreSQL localmente usando Docker para o backend da aplicação Cred30.

## Pré-requisitos

- Docker instalado no seu computador

## Passos para configurar o PostgreSQL

1. **Iniciar o container PostgreSQL**
   - No diretório raiz do projeto, execute:
     ```bash
     docker-compose up -d
     ```
   - Isso irá baixar a imagem do PostgreSQL e iniciar um container com o banco de dados.

2. **Verificar se o container está rodando**

   ```bash
   docker ps
   ```

   - Você deve ver um container chamado `cred30-postgres` em execução.

3. **Instalar as dependências do backend**

   ```bash
   cd backend
   bun install
   ```

4. **Iniciar o servidor backend**

   ```bash
   bun run dev
   ```

   - O servidor irá se conectar ao PostgreSQL local e criar as tabelas necessárias.

5. **Iniciar o servidor frontend**
   - Em outro terminal, na raiz do projeto:
     ```bash
     npm run dev
     ```

## Configuração do Banco de Dados

O PostgreSQL será configurado com as seguintes credenciais:

- **Host**: localhost
- **Porta**: 5432
- **Usuário**: cred30user
- **Senha**: cred30pass
- **Banco de dados**: cred30

## Estrutura do Banco de Dados

O backend criará automaticamente as seguintes tabelas:

1. **users**: Usuários do sistema
2. **quotas**: Cotas de investimento
3. **loans**: Empréstimos solicitados
4. **transactions**: Transações financeiras

## Acessar o Banco de Dados

Se você precisar acessar o banco de dados diretamente, pode usar o psql:

```bash
docker exec -it cred30-postgres psql -U cred30user -d cred30
```

## Parar o Container

Para parar o container PostgreSQL:

```bash
docker-compose down
```

## Reiniciar o Container

Para reiniciar o container PostgreSQL:

```bash
docker-compose restart
```

## Solução de Problemas

### Erro: "Connection refused"

Isso geralmente significa que o container PostgreSQL não está rodando. Verifique:

1. Se o Docker está instalado e rodando
2. Se o container foi iniciado corretamente com `docker-compose up -d`
3. Se a porta 5432 não está sendo usada por outro serviço

### Erro: "Database does not exist"

Isso pode acontecer se o container foi iniciado mas as tabelas não foram criadas. Verifique:

1. Se o backend está rodando e se conectando ao banco de dados
2. Se não há erros nos logs do backend
