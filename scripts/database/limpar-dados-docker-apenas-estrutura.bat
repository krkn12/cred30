@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM LIMPAR DADOS DO BANCO DOCKER - MANTER APENAS ESTRUTURA - CRED30 (BATCH)
REM =============================================================================

echo.
echo 🗑️ LIMPAR DADOS DO BANCO DOCKER - CRED30
echo 🚨 ATENÇÃO: Isso irá APAGAR TODOS OS DADOS mas manter a estrutura!
echo.

REM Verificar se o container está rodando
docker ps | findstr "cred30-postgres" >nul
if errorlevel 1 (
    docker ps | findstr "cred30-db-local" >nul
    if errorlevel 1 (
        echo ❌ Container PostgreSQL não está rodando!
        echo 📋 Inicie o container com:
        echo    docker-compose -f docker/docker-compose.yml up -d
        echo    ou
        echo    docker-compose -f docker/docker-compose.local.yml up -d
        pause
        exit /b 1
    )
)

REM Determinar nome do container
set CONTAINER_NAME=cred30-postgres
docker ps | findstr "cred30-db-local" >nul
if not errorlevel 1 (
    set CONTAINER_NAME=cred30-db-local
)

echo 📦 Container encontrado: %CONTAINER_NAME%

REM Criar diretório de backups se não existir
if not exist "./backups" mkdir "./backups"

REM Gerar timestamp para backup
set TIMESTAMP=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=./backups/cred30_backup_before_wipe_%TIMESTAMP%.sql

REM Criar backup antes de limpar
echo 💾 Criando backup antes de apagar...
docker exec %CONTAINER_NAME% pg_dump -U cred30user -d cred30 > %BACKUP_FILE%

if errorlevel 1 (
    echo ❌ Falha ao criar backup! Abortando...
    pause
    exit /b 1
)

REM Comprimir backup
gzip %BACKUP_FILE%
if exist %BACKUP_FILE% del %BACKUP_FILE%
echo ✅ Backup criado: ./backups/cred30_backup_before_wipe_%TIMESTAMP%.sql.gz

echo.
echo 🔥 APAGANDO TODOS OS DADOS (MANTENDO ESTRUTURA)...
echo.

REM Criar script SQL temporário para limpar dados
set sqlFile=limpar_dados_sql.sql

echo -- Script para limpar todos os dados mantendo a estrutura > %sqlFile%
echo -- Desabilitar triggers temporariamente >> %sqlFile%
echo SET session_replication_role = replica; >> %sqlFile%
echo. >> %sqlFile%
echo -- Limpar tabelas em ordem correta (respeitando foreign keys) >> %sqlFile%
echo -- Tabelas sem dependências primeiro >> %sqlFile%
echo TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE; >> %sqlFile%
echo TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE; >> %sqlFile%
echo TRUNCATE TABLE transactions RESTART IDENTITY CASCADE; >> %sqlFile%
echo TRUNCATE TABLE quotas RESTART IDENTITY CASCADE; >> %sqlFile%
echo TRUNCATE TABLE loans RESTART IDENTITY CASCADE; >> %sqlFile%
echo. >> %sqlFile%
echo -- Tabela de usuários (limpar por último devido às referências) >> %sqlFile%
echo TRUNCATE TABLE users RESTART IDENTITY CASCADE; >> %sqlFile%
echo. >> %sqlFile%
echo -- Resetar configurações do sistema para valores padrão >> %sqlFile%
echo UPDATE app_settings SET value = '50' WHERE key = 'quota_price'; >> %sqlFile%
echo UPDATE app_settings SET value = '0.2' WHERE key = 'loan_interest_rate'; >> %sqlFile%
echo UPDATE app_settings SET value = '0.4' WHERE key = 'penalty_rate'; >> %sqlFile%
echo. >> %sqlFile%
echo -- Reabilitar triggers >> %sqlFile%
echo SET session_replication_role = DEFAULT; >> %sqlFile%
echo. >> %sqlFile%
echo -- Forçar atualização das estatísticas do PostgreSQL >> %sqlFile%
echo ANALYZE; >> %sqlFile%
echo. >> %sqlFile%
echo -- Relatório final >> %sqlFile%
echo DO $$ >> %sqlFile%
echo BEGIN >> %sqlFile%
echo     RAISE NOTICE '========================================'; >> %sqlFile%
echo     RAISE NOTICE '  LIMPEZA DE DADOS CONCLUÍDA'; >> %sqlFile%
echo     RAISE NOTICE '========================================'; >> %sqlFile%
echo     RAISE NOTICE 'Data/Hora: %', CURRENT_TIMESTAMP; >> %sqlFile%
echo     RAISE NOTICE 'Estrutura mantida: SIM'; >> %sqlFile%
echo     RAISE NOTICE 'Dados removidos: TODOS'; >> %sqlFile%
echo     RAISE NOTICE 'Sequências resetadas: SIM'; >> %sqlFile%
echo     RAISE NOTICE '========================================'; >> %sqlFile%
echo END $$; >> %sqlFile%

REM Executar script de limpeza
docker exec -i %CONTAINER_NAME% psql -U cred30user -d cred30 < %sqlFile%

if errorlevel 1 (
    echo ❌ Falha ao apagar dados!
    if exist %sqlFile% del %sqlFile%
    pause
    exit /b 1
)

REM Limpar arquivo temporário
if exist %sqlFile% del %sqlFile%

echo.
echo ✅ DADOS APAGADOS COM SUCESSO!
echo.
echo 🎯 RESULTADO:
echo ✅ Estrutura do banco mantida
echo ❌ Todos os dados apagados
echo ❌ Todos os usuários removidos
echo ✅ Sistema pronto para novos dados
echo.
echo 🔄 PRÓXIMOS PASSOS:
echo 1. Para inserir novos usuários via SQL:
echo    docker exec -it %CONTAINER_NAME% psql -U cred30user -d cred30
echo.
echo 2. Para criar um novo admin:
echo    INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at)
echo    VALUES ('Seu Nome', 'seu@email.com', 'senha_hash', 'sua@chave.pix', 'sua_frase_secreta', 'CODIGO001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
echo.
echo 3. Backup criado:
echo    ./backups/cred30_backup_before_wipe_%TIMESTAMP%.sql.gz
echo.

REM Verificação final
echo 🔍 Verificando estado final do banco...
for /f "tokens=*" %%a in ('docker exec %CONTAINER_NAME% psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users;"') do set usersCount=%%a
for /f "tokens=*" %%a in ('docker exec %CONTAINER_NAME% psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"') do set tableCount=%%a

set usersCount=%usersCount: =%
set tableCount=%tableCount: =%

echo Usuarios restantes: %usersCount%
echo Tabelas mantidas: %tableCount%

if "%usersCount%"=="0" (
    if %tableCount% GTR 0 (
        echo ✅ Confirmação: Dados apagados e estrutura mantida!
    ) else (
        echo ⚠️  Dados apagados mas algumas tabelas podem estar faltando
    )
) else (
    echo ❌ Alerta: Ainda existem usuarios no banco
)

echo.
echo 🎉 Operação concluida!
echo.
pause