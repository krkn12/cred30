@echo off
chcp 65001 >nul
echo INICIANDO CONTAINERS ESSENCIAIS...
echo ====================================

echo Iniciando PostgreSQL...
docker run -d --name cred30-postgres-single -e POSTGRES_DB=cred30 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15-alpine

echo Aguardando PostgreSQL iniciar...
timeout /t 10 /nobreak >nul

echo Verificando conexao com PostgreSQL...
docker exec cred30-postgres-single psql -U postgres -d cred30 -c "SELECT 'PostgreSQL conectado com sucesso!' as status;"

echo.
echo PostgreSQL iniciado com sucesso!
echo Banco de dados disponivel em: localhost:5432
echo Usuario: postgres
echo Senha: postgres
echo Database: cred30
echo.
pause