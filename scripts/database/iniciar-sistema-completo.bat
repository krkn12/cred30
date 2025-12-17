@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM INICIAR SISTEMA COMPLETO - CRED30 (BATCH)
REM =============================================================================

echo.
echo 🚀 INICIAR SISTEMA COMPLETO - CRED30
echo.

echo 📋 ESTE SCRIPT IRA:
echo    1. Verificar Docker
echo    2. Iniciar containers se necessario
echo    3. Aguardar PostgreSQL estar pronto
echo    4. Recriar banco se necessario
echo    5. Criar admin se necessario
echo.

echo ⚠️  ATENCAO: Isso ira APAGAR TODOS OS DADOS atuais!
echo.
set /p confirm="Deseja continuar? (S/N): "
if /i not "%confirm%"=="S" (
    echo ❌ Operacao cancelada pelo usuario
    pause
    exit /b 0
)

echo.
echo 🔍 PASSO 1: Verificando Docker...
echo.

REM Verificar Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker nao encontrado!
    echo    Por favor, instale o Docker Desktop
    pause
    exit /b 1
) else (
    echo ✅ Docker encontrado
)

REM Verificar se Docker daemon esta rodando
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker daemon nao esta rodando!
    echo    Iniciando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker Desktop.exe"
    echo ⏳ Aguardando Docker iniciar...
    timeout /t 30 /nobreak
    
    docker info >nul 2>&1
    if errorlevel 1 (
        echo ❌ Falha ao iniciar Docker!
        pause
        exit /b 1
    )
) else (
    echo ✅ Docker daemon rodando
)

echo.
echo 🔍 PASSO 2: Verificando containers...
echo.

REM Listar containers
echo 📋 Containers atuais:
docker ps -a --format "table {{.Names}}\t{{.Status}}"

REM Verificar se cred30-postgres existe
docker ps -a --format "{{.Names}}" | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo ❌ Container cred30-postgres nao encontrado!
    echo    Tentando criar com docker-compose...
    
    REM Tentar docker-compose
    if exist "docker-compose.yml" (
        echo 🔄 Iniciando com docker-compose...
        docker-compose up -d
        if errorlevel 1 (
            echo ❌ Falha no docker-compose!
            pause
            exit /b 1
        )
        echo ✅ Containers iniciados com docker-compose
    ) else (
        echo ❌ docker-compose.yml nao encontrado!
        pause
        exit /b 1
    )
) else (
    echo ✅ Container cred30-postgres encontrado
)

REM Verificar se esta rodando
docker ps --format "{{.Names}}" | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo 🔄 Iniciando container cred30-postgres...
    docker start cred30-postgres
    if errorlevel 1 (
        echo ❌ Falha ao iniciar container!
        pause
        exit /b 1
    )
    echo ✅ Container iniciado
) else (
    echo ✅ Container ja esta rodando
)

echo.
echo 🔍 PASSO 3: Aguardando PostgreSQL...
echo.

REM Aguardar PostgreSQL estar pronto
set max_attempts=30
set attempt=1

:wait_postgres
echo    Tentativa %attempt% de %max_attempts%...
docker exec cred30-postgres pg_isready -U cred30user >nul 2>&1
if errorlevel 1 (
    if %attempt% GEQ %max_attempts% (
        echo ❌ PostgreSQL nao ficou pronto em %max_attempts% tentativas!
        echo    Verifique os logs: docker logs cred30-postgres
        pause
        exit /b 1
    )
    echo ⏳ Aguardando 5 segundos...
    timeout /t 5 /nobreak >nul
    set /a attempt+=1
    goto wait_postgres
) else (
    echo ✅ PostgreSQL esta pronto!
)

echo.
echo 🔍 PASSO 4: Recriando banco de dados...
echo.

REM Recriar banco
docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql
if errorlevel 1 (
    echo ❌ Falha ao recriar banco!
    pause
    exit /b 1
) else (
    echo ✅ Banco recriado com sucesso!
)

echo.
echo 🔍 PASSO 5: Criando administrador...
echo.

REM Criar admin
set sqlFile=create_admin_temp.sql
echo INSERT INTO users ^(name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at^) VALUES ^('Administrador Cred30', 'josiassm701@gmail.com', 'admin_temp_hash_123', 'admin@cred30.pix', 'cred30_admin_secret', 'CRED30ADMIN', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP^); > %sqlFile%

docker exec -i cred30-postgres psql -U cred30user -d cred30 < %sqlFile%
if errorlevel 1 (
    echo ❌ Falha ao criar admin!
    if exist %sqlFile% del %sqlFile%
    pause
    exit /b 1
)

if exist %sqlFile% del %sqlFile%

echo.
echo ✅ Administrador criado com sucesso!
echo.

echo 📋 DADOS DO ADMINISTRADOR:
echo    Nome: Administrador Cred30
echo    Email: josiassm701@gmail.com
echo    PIX: admin@cred30.pix
echo    Frase Secreta: cred30_admin_secret
echo    Codigo Ref: CRED30ADMIN
echo    Senha Temporaria: admin_temp_hash_123
echo.
echo ⚠️  IMPORTANTE: Altere a senha no primeiro acesso!

echo.
echo 🔍 PASSO 6: Verificacao final...
echo.

REM Verificar admin criado
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users WHERE is_admin = true;"') do set adminCount=%%a
echo    Administradores: %adminCount%

REM Verificar tabelas
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';"') do set tableCount=%%a
echo    Tabelas criadas: %tableCount%

if %adminCount% GTR 0 (
    if %tableCount% GTR 0 (
        echo ✅ Sistema configurado com sucesso!
    ) else (
        echo ⚠️  Admin criado mas tabelas podem estar faltando
    )
) else (
    echo ❌ Falha na criacao do admin
)

echo.
echo 🎉 SISTEMA CRED30 PRONTO PARA USO!
echo.
echo 🔄 PROXIMOS PASSOS:
echo    1. Acesse a aplicacao
echo    2. Use email: josiassm701@gmail.com
echo    3. Use senha: admin_temp_hash_123
echo    4. Altere a senha no primeiro acesso
echo    5. Comece a usar o sistema
echo.
echo 🌐 Para acessar a aplicacao, verifique a URL no terminal do backend
echo.
echo 📋 Comandos uteis:
echo    Verificar status: docker ps
echo    Verificar logs: docker logs cred30-postgres
echo    Parar sistema: docker-compose down
echo    Reiniciar sistema: docker-compose restart
echo.
echo 🎉 OPERACAO CONCLUIDA COM SUCESSO!
echo.
pause