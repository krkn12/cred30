@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM VERIFICAR DOCKER - CRED30 (BATCH)
REM =============================================================================

echo.
echo 🐳 VERIFICACAO DOCKER - CRED30
echo.

echo 🔍 Verificando status do Docker...
echo.

REM Verificar se Docker esta rodando
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker nao esta instalado ou nao esta no PATH!
    echo.
    echo 💡 SOLUCOES:
    echo    1. Verifique se Docker Desktop esta instalado
    echo    2. Verifique se Docker Desktop esta rodando
    echo    3. Reinicie o Docker Desktop
    echo    4. Reinstale o Docker se necessario
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Docker esta instalado
)

REM Verificar se Docker daemon esta rodando
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker daemon nao esta rodando!
    echo.
    echo 💡 SOLUCOES:
    echo    1. Inicie o Docker Desktop
    echo    2. Aguarde alguns segundos para inicializacao
    echo    3. Verifique se ha erros no Docker Desktop
    echo.
    echo 🔄 Tentando iniciar Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo.
    echo ⏳ Aguardando 15 segundos para Docker iniciar...
    timeout /t 15 /nobreak
    echo.
    
    REM Verificar novamente
    docker info >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker ainda nao esta rodando!
        echo    Por favor, inicie o Docker Desktop manualmente
        pause
        exit /b 1
    ) else (
        echo ✅ Docker iniciado com sucesso!
    )
) else (
    echo ✅ Docker daemon esta rodando
)

echo.
echo 🔍 Verificando containers...
echo.

REM Listar containers disponiveis
echo 📋 Containers disponiveis:
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo.

REM Verificar se container cred30-postgres existe
docker ps -a --format "{{.Names}}" | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo ❌ Container cred30-postgres nao encontrado!
    echo.
    echo 💡 SOLUCOES:
    echo    1. Verifique se o nome do container esta correto
    echo    2. Verifique se o projeto foi iniciado com docker-compose
    echo    3. Execute docker-compose up no diretorio do projeto
    echo.
    echo 🔄 Tentando encontrar containers relacionados...
    docker ps -a --format "{{.Names}}" | findstr "postgres\|db\|database"
    echo.
    echo 📋 Para iniciar o projeto com docker-compose:
    echo    cd C:\Users\josia\Desktop\projetos\cred30
    echo    docker-compose up -d
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Container cred30-postgres encontrado
)

REM Verificar se container esta rodando
docker ps --format "{{.Names}}" | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo ❌ Container cred30-postgres nao esta rodando!
    echo.
    echo 💡 SOLUCOES:
    echo    1. Iniciar o container: docker start cred30-postgres
    echo    2. Subir com docker-compose: docker-compose up -d
    echo    3. Verificar logs para erros: docker logs cred30-postgres
    echo.
    echo 🔄 Tentando iniciar o container...
    docker start cred30-postgres
    
    if errorlevel 1 (
        echo ❌ Falha ao iniciar container!
        echo    Verifique os logs para mais detalhes
        pause
        exit /b 1
    ) else (
        echo ✅ Container iniciado com sucesso!
        echo ⏳ Aguardando 10 segundos para PostgreSQL iniciar...
        timeout /t 10 /nobreak
    )
) else (
    echo ✅ Container cred30-postgres esta rodando
)

REM Testar conexao com PostgreSQL
echo.
echo 🔍 Testando conexao com PostgreSQL...
echo.

docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo ❌ Falha na conexao com PostgreSQL!
    echo.
    echo 💡 POSSIVEIS CAUSAS:
    echo    1. PostgreSQL ainda esta iniciando
    echo    2. Credenciais incorretas
    echo    3. Configuracao de rede
    echo.
    echo 🔄 Aguardando mais 5 segundos...
    timeout /t 5 /nobreak
    
    REM Testar novamente
    docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT 1;" >nul 2>&1
    if errorlevel 1 (
        echo ❌ Ainda nao e possivel conectar!
        echo    Verifique os logs: docker logs cred30-postgres
        pause
        exit /b 1
    ) else (
        echo ✅ Conexao estabelecida!
    )
) else (
    echo ✅ Conexao com PostgreSQL estabelecida!
)

echo.
echo 🎉 VERIFICACAO CONCLUIDA!
echo.
echo 📋 Status final:
echo    ✅ Docker: Instalado e rodando
echo    ✅ Container: cred30-postgres rodando
echo    ✅ PostgreSQL: Conexao estabelecida
echo.
echo 🚀 Sistema pronto para usar os scripts de limpeza!
echo.
echo 🔄 Para executar os scripts:
echo    1. Apagar tudo: scripts\database\apagar-tudo-inclusive-admin.bat
echo    2. Recriar banco: scripts\database\recriar-banco-completo.bat
echo    3. Criar admin: scripts\database\criar-admin.bat
echo.
pause