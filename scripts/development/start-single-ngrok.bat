@echo off
REM Script para iniciar o CRED30 com uma única instância do ngrok
REM Este script configura o ambiente com proxy reverso para usar apenas um túnel ngrok

echo 🚀 Iniciando CRED30 com ngrok único...

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
docker-compose -f docker-compose.single-ngrok.yml down --remove-orphans

REM Perguntar sobre limpeza de dados
set /p cleanup="Deseja limpar dados antigos? (s/N): "
if /i "%cleanup%"=="s" (
    echo 🧹 Limpando volumes...
    docker volume rm cred30_postgres_data cred30_redis_data 2>nul
)

REM Iniciar containers
echo 🐳 Iniciando containers com proxy reverso...
docker compose -f docker-compose.single-ngrok.yml up -d

REM Aguardar serviços iniciarem
echo ⏳ Aguardando serviços iniciarem...
timeout /t 30 /nobreak >nul

REM Verificar se serviços estão saudáveis
echo 🔍 Verificando saúde dos serviços...
docker compose -f docker-compose.single-ngrok.yml ps

REM Testar frontend
echo 🧪 Testando frontend...
curl -f http://localhost:5173 >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Frontend está funcionando!
) else (
    echo ⚠️ Frontend pode não estar totalmente pronto. Aguardando mais...
    timeout /t 20 /nobreak >nul
)

REM Testar backend via proxy
echo 🧪 Testando backend via proxy...
curl -f http://localhost:5173/api/health >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Backend está funcionando via proxy!
) else (
    echo ⚠️ Backend pode não estar totalmente pronto. Aguardando mais...
    timeout /t 20 /nobreak >nul
)

REM Popular dados de teste
echo 🌱 Populando dados de teste...
cd backend
node scripts/populate-test-data.js
cd ..

REM Iniciar ngrok para frontend (com proxy para backend)
echo 🌐 Iniciando ngrok para frontend (com proxy reverso)...
start "Ngrok CRED30" cmd /k "ngrok http 5173 --log=stdout"

REM Aguardar ngrok inicializar
echo ⏳ Aguardando ngrok inicializar...
timeout /t 10 /nobreak >nul

echo.
echo 🎉 CRED30 está online com ngrok único!
echo.
echo 📱 Acesso Completo (Frontend + Backend via proxy):
echo    Local: http://localhost:5173
echo    Externo: Verifique a janela do Ngrok CRED30
echo.
echo 🔧 Endpoints disponíveis:
echo    Frontend: [URL do ngrok]
echo    API: [URL do ngrok]/api
echo    Dashboard Admin: [URL do ngrok]/admin
echo.
echo 👥 Usuários para teste:
echo    Admin: admin@cred30.com / admin123
echo    Cliente: joao@cred30.com / cliente123
echo.
echo 🛠️ Comandos úteis:
echo    Ver logs: docker compose -f docker-compose.single-ngrok.yml logs -f
echo    Parar tudo: docker compose -f docker-compose.single-ngrok.yml down
echo.
echo ⚠️  Mantenha a janela do ngrok aberta para manter o acesso externo.
echo    Feche a janela para parar o ngrok.
echo.
echo Pressione qualquer tecla para sair...
pause >nul