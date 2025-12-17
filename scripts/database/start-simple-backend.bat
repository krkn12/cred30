@echo off
echo Iniciando PostgreSQL e Backend apenas...
echo.

echo [1/3] Parando containers existentes...
docker stop cred30-postgres cred30-backend-single 2>nul
docker rm cred30-postgres cred30-backend-single 2>nul

echo [2/3] Iniciando PostgreSQL...
docker run -d --name cred30-postgres ^
  -e POSTGRES_DB=cred30 ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -p 5432:5432 ^
  postgres:15-alpine

echo [3/3] Aguardando PostgreSQL iniciar...
timeout /t 10 /nobreak >nul

echo.
echo PostgreSQL iniciado na porta 5432
echo Usuario: postgres
echo Senha: postgres
echo Database: cred30
echo.
echo Use: docker exec -it cred30-postgres psql -U postgres -d cred30
echo.
pause