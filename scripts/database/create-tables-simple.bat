@echo off
chcp 65001 >nul

echo =============================================================================
echo CRIACAO DE TABELAS - VERSAO BATCH SIMPLES
echo =============================================================================

echo.
echo Verificando Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERRO: Docker nao esta rodando
    pause
    exit /b 1
)

echo.
echo Verificando container PostgreSQL...
docker ps --format "table {{.Names}}" | findstr postgres >nul
if errorlevel 1 (
    echo ERRO: Container PostgreSQL nao encontrado
    pause
    exit /b 1
)

echo Container PostgreSQL encontrado
echo.

echo Executando script SQL...
docker exec cred30-postgres psql -U cred30user -d cred30 -f create-missing-tables.sql

if errorlevel 1 (
    echo.
    echo Tentando com usuario postgres...
    docker exec cred30-postgres psql -U postgres -d cred30 -f create-missing-tables.sql
    
    if errorlevel 1 (
        echo ERRO: Falha ao executar script SQL
        pause
        exit /b 1
    )
)

echo.
echo Verificando tabelas criadas...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"

echo.
echo Tabelas criadas com sucesso!
echo.
echo Próximos passos:
echo 1. Teste a aplicacao frontend
echo 2. Verifique os logs do backend
echo 3. Execute testes de integracao
echo.
pause