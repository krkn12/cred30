@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM RECRIAR BANCO COMPLETO - CRED30 (BATCH)
REM =============================================================================

echo.
echo 🔧 RECRIAR BANCO COMPLETO - CRED30
echo.

REM Verificar se o container esta rodando
docker ps | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo ❌ Container cred30-postgres nao esta rodando!
    pause
    exit /b 1
)

echo 🔄 Recriando estrutura completa do banco...
echo.

REM Executar script de inicializacao
docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql

if errorlevel 1 (
    echo ❌ Falha ao recriar o banco!
    pause
    exit /b 1
)

echo.
echo ✅ Banco recriado com sucesso!
echo.
echo 🎯 PROXIMOS PASSOS:
echo 1. Para criar um novo admin manualmente:
echo    docker exec -it cred30-postgres psql -U cred30user -d cred30
echo.
echo 2. Inserir admin com SQL:
echo    INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at) 
echo    VALUES ('Seu Nome', 'seu@email.com', 'senha_hash', 'sua@chave.pix', 'sua_frase_secreta', 'CODIGO001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
echo.

REM Verificacao final
echo 🔍 Verificando criacao das tabelas...
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';"') do set tableCount=%%a
echo Tabelas criadas: %tableCount%

if %tableCount% GTR 0 (
    echo ✅ Banco recriado com sucesso!
) else (
    echo ❌ Problema na criacao do banco
)

echo.
echo 🎉 Operacao concluida!
echo.
pause