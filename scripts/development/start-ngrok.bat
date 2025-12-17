@echo off
REM Script para iniciar o CRED30 com ngrok no Windows
REM Este script configura o ambiente e inicia os serviços com ngrok para acesso externo

echo 🚀 Iniciando CRED30 com ngrok...

REM Verificar se ngrok está instalado
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ngrok não encontrado. Por favor, instale o ngrok:
    echo    - Via npm: npm install -g ngrok
    echo    - Ou baixe de https://ngrok.com/download
    pause
    exit /b 1
)

REM Verificar se Docker está rodando
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker não está rodando. Por favor, inicie o Docker Desktop.
    pause
    exit /b 1
)

REM Parar containers existentes
echo 🛑 Parando containers existentes...
docker-compose -f docker-compose.ngrok.yml down --remove-orphans

REM Perguntar sobre limpeza de dados
set /p cleanup="Deseja limpar dados antigos? (s/N): "
if /i "%cleanup%"=="s" (
    echo 🧹 Limpando volumes...
    docker volume rm cred30_postgres_data cred30_redis_data 2>nul
)

REM Iniciar containers
echo 🐳 Iniciando containers...
docker-compose -f docker-compose.ngrok.yml up -d

REM Aguardar serviços iniciarem
echo ⏳ Aguardando serviços iniciarem...
timeout /t 30 /nobreak >nul

REM Verificar se serviços estão saudáveis
echo 🔍 Verificando saúde dos serviços...
docker-compose -f docker-compose.ngrok.yml ps

REM Testar backend
echo 🧪 Testando backend...
curl -f http://localhost:3001/api/health >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Backend está funcionando!
) else (
    echo ⚠️ Backend pode não estar totalmente pronto. Aguardando mais...
    timeout /t 20 /nobreak >nul
)

REM Testar frontend
echo 🧪 Testando frontend...
curl -f http://localhost:5173 >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Frontend está funcionando!
) else (
    echo ⚠️ Frontend pode não estar totalmente pronto. Aguardando mais...
    timeout /t 20 /nobreak >nul
)

REM Iniciar ngrok para frontend
echo 🌐 Iniciando ngrok para frontend (porta 5173)...
start "Ngrok Frontend" cmd /k "ngrok http 5173"

REM Iniciar ngrok para backend
echo 🔌 Iniciando ngrok para backend (porta 3001)...
start "Ngrok Backend" cmd /k "ngrok http 3001"

REM Aguardar ngrok inicializar
echo ⏳ Aguardando ngrok inicializar...
timeout /t 10 /nobreak >nul

echo.
echo 🎉 CRED30 está online com ngrok!
echo.
echo 📱 Frontend (Interface Web):
echo    Local: http://localhost:5173
echo    Externo: Verifique a janela do Ngrok Frontend
echo.
echo 🔌 Backend (API):
echo    Local: http://localhost:3001
echo    Externo: Verifique a janela do Ngrok Backend
echo.
echo 👥 Usuários para teste:
echo    Admin: admin@cred30.com / admin123
echo    Cliente: cliente@cred30.com / cliente123
echo.
echo 📊 Dashboard Admin: [URL do ngrok frontend]/admin
echo 🏠 Dashboard Cliente: [URL do ngrok frontend]
echo.
echo 🛠️ Comandos úteis:
echo    Ver logs: docker-compose -f docker-compose.ngrok.yml logs -f
echo    Parar tudo: docker-compose -f docker-compose.ngrok.yml down
echo.
echo ⚠️  Mantenha as janelas do ngrok abertas para manter o acesso externo.
echo    Feche as janelas para parar o ngrok.
echo.
echo Pressione qualquer tecla para sair...
pause >nul