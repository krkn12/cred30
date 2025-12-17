@echo off
chcp 65001 >nul
echo ========================================
echo    AUDITORIA COMPLETA DO SISTEMA CRED30
echo ========================================
echo.

echo 📦 VERIFICANDO CONTAINERS DOCKER...
echo ----------------------------------------
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo 🗄️  VERIFICANDO BANCO DE DADOS...
echo ----------------------------------------
docker exec postgres psql -U postgres -d cred30 -c "SELECT COUNT(*) as usuarios FROM users;" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Conexao com PostgreSQL estabelecida
    echo.
    echo 📋 Tabelas no banco de dados:
    docker exec postgres psql -U postgres -d cred30 -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" -t 2>nul
    echo.
    echo 📊 Contagem de registros:
    docker exec postgres psql -U postgres -d cred30 -c "SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'transactions', COUNT(*) FROM transactions UNION ALL SELECT 'quotas', COUNT(*) FROM quotas UNION ALL SELECT 'loans', COUNT(*) FROM loans;" -t 2>nul
) else (
    echo ❌ Falha na conexao com PostgreSQL
)
echo.

echo 🔍 VERIFICANDO LOGS DE ERRO...
echo ----------------------------------------
echo 📝 Logs do Backend (ultimas 10 linhas):
docker logs backend --tail 10 2>&1 | findstr /i "error"
if %errorlevel% neq 0 echo ✅ Nenhum erro encontrado nos logs recentes
echo.
echo 📝 Logs do Frontend (ultimas 10 linhas):
docker logs frontend --tail 10 2>&1 | findstr /i "error"
if %errorlevel% neq 0 echo ✅ Nenhum erro encontrado nos logs recentes
echo.

echo 🌐 VERIFICANDO ACESSO ÀS APIS...
echo ----------------------------------------
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend API respondendo
) else (
    echo ❌ Backend API nao respondendo
)
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend respondendo
) else (
    echo ❌ Frontend nao respondendo
)
echo.

echo 💻 VERIFICANDO USO DE RECURSOS...
echo ----------------------------------------
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo.

echo ========================================
echo           AUDITORIA CONCLUÍDA
echo ========================================
echo.
echo 📋 RESUMO DA AUDITORIA:
echo   • Containers Docker verificados
echo   • Banco de dados analisado
echo   • Logs de erro verificados
echo   • APIs acessibilidade verificada
echo   • Recursos do sistema monitorados
echo.
echo Se houver erros, eles serao listados acima.
echo Se tudo estiver verde, o sistema esta funcionando corretamente!
pause