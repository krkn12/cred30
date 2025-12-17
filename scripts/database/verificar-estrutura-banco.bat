
@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM VERIFICAR ESTRUTURA DO BANCO - CRED30 (BATCH)
REM =============================================================================

echo.
echo 🔍 VERIFICAR ESTRUTURA DO BANCO - CRED30
echo.

REM Verificar se o container esta rodando
docker ps | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo ❌ Container cred30-postgres nao esta rodando!
    pause
    exit /b 1
)

echo 📊 ANALISE COMPLETA DA ESTRUTURA:
echo.

REM Contar usuarios
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users;"') do set usersCount=%%a
echo 👥 Usuarios totais: %usersCount%

REM Contar admins
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users WHERE is_admin = true;"') do set adminCount=%%a
echo 👤 Administradores: %adminCount%

REM Contar clientes
set /a clientCount=%usersCount%-%adminCount%
echo 👥 Clientes: %clientCount%

REM Contar cotas
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM quotas;"') do set quotasCount=%%a
echo 📊 Cotas vendidas: %quotasCount%

REM Contar emprestimos
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM loans;"') do set loansCount=%%a
echo 💰 Emprestimos: %loansCount%

REM Contar transacoes
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM transactions;"') do set transactionsCount=%%a
echo 💸 Transacoes: %transactionsCount%

REM Verificar saldo do sistema
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COALESCE(system_balance, 0) FROM system_config;"') do set systemBalance=%%a
echo 💳 Saldo do sistema: R$ %systemBalance%

REM Verificar pool de lucros
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COALESCE(profit_pool, 0) FROM system_config;"') do set profitPool=%%a
echo 💎 Pool de lucros: R$ %profitPool%

REM Contar tabelas
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';"') do set tableCount=%%a
echo 📋 Tabelas no banco: %tableCount%

echo.
echo 🎯 STATUS DO BANCO:
echo.

REM Determinar status
if %usersCount%==0 (
    if %tableCount% GTR 0 (
        echo ✅ BANCO VAZIO (estrutura mantida)
        echo    📋 Estrutura: OK (%tableCount% tabelas)
        echo    👥 Usuarios: 0
