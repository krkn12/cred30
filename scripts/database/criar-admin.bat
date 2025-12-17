@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM CRIAR ADMIN MANUALMENTE - CRED30 (BATCH)
REM =============================================================================

echo.
echo 👤 CRIAR ADMIN MANUALMENTE - CRED30
echo.

REM Verificar se o container esta rodando
docker ps | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo ❌ Container cred30-postgres nao esta rodando!
    pause
    exit /b 1
)

echo 🔐 Conectando ao banco para criar admin...
echo.

REM Criar script SQL temporario
set sqlFile=create_admin_temp.sql

echo INSERT INTO users ^(name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at^) VALUES ^('Administrador', 'josiassm701@gmail.com', 'admin_hash_temp', 'admin@pix.local', 'admin_secret', 'ADMIN001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP^); > %sqlFile%

REM Executar insercao
docker exec -i cred30-postgres psql -U cred30user -d cred30 < %sqlFile%

if errorlevel 1 (
    echo ❌ Falha ao criar admin!
    if exist %sqlFile% del %sqlFile%
    pause
    exit /b 1
)

REM Limpar arquivo temporario
if exist %sqlFile% del %sqlFile%

echo.
echo ✅ Administrador criado com sucesso!
echo.
echo 📋 DADOS DO ADMIN:
echo    Nome: Administrador
echo    Email: josiassm701@gmail.com
echo    PIX: admin@pix.local
echo    Frase Secreta: admin_secret
echo    Codigo Ref: ADMIN001
echo    Senha Temporaria: admin_hash_temp
echo.
echo ⚠️  IMPORTANTE: Altere a senha temporaria no primeiro acesso!
echo.

REM Verificacao
echo 🔍 Verificando criacao do admin...
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users WHERE is_admin = true;"') do set adminCount=%%a
echo Administradores criados: %adminCount%

if %adminCount% GTR 0 (
    echo ✅ Admin criado com sucesso!
    echo 🎉 Sistema pronto para uso!
) else (
    echo ❌ Falha na criacao do admin
)

echo.
echo 🔄 Para testar o acesso:
echo    1. Acesse a aplicacao
echo    2. Use email: josiassm701@gmail.com
echo    3. Use senha temporaria e altere apos primeiro acesso
echo.
echo 🎉 Operacao concluida!
echo.
pause