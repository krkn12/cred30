@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM APAGAR TUDO (INCLUSIVE ADMIN) - CRED30 (BATCH)
REM =============================================================================

echo.
echo 💀 APAGAR TUDO (INCLUSIVE ADMIN) - CRED30
echo 🚨 ATENCAO: ESTE SCRIPT APAGARA 100% DOS DADOS!
echo.

REM Verificar se o container esta rodando
docker ps | findstr "cred30-postgres" >nul
if errorlevel 1 (
    echo ❌ Container cred30-postgres nao esta rodando!
    pause
    exit /b 1
)

REM Criar backup
echo 💾 Criando backup de emergencia...
if not exist "./backups" mkdir "./backups"

set TIMESTAMP=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set backupFile=./backups/emergency_backup_before_wipe_%TIMESTAMP%.sql

docker exec cred30-postgres pg_dump -U cred30user -d cred30 > %backupFile%
if errorlevel 1 (
    echo ❌ Falha ao criar backup! Abortando...
    pause
    exit /b 1
)

gzip %backupFile%
if exist %backupFile% del %backupFile%
echo ✅ Backup criado: ./backups/emergency_backup_before_wipe_%TIMESTAMP%.sql.gz

echo.
echo 🔥 INICIANDO APAGAMENTO COMPLETO...
echo.

REM Criar arquivo SQL temporario
set sqlFile=temp_wipe_complete.sql

echo BEGIN; > %sqlFile%
echo ALTER TABLE users DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE quotas DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE loans DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE transactions DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE loan_installments DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE withdrawals DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE user_statistics DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE referrals DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE support_tickets DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE fee_history DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE notifications DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE user_sessions DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE audit_logs DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE admin_logs DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE backup_logs DISABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE rate_limit_logs DISABLE TRIGGER ALL; >> %sqlFile%
echo DELETE FROM loan_installments; >> %sqlFile%
echo DELETE FROM withdrawals; >> %sqlFile%
echo DELETE FROM transactions; >> %sqlFile%
echo DELETE FROM quotas; >> %sqlFile%
echo DELETE FROM loans; >> %sqlFile%
echo DELETE FROM user_statistics; >> %sqlFile%
echo DELETE FROM referrals; >> %sqlFile%
echo DELETE FROM support_tickets; >> %sqlFile%
echo DELETE FROM fee_history; >> %sqlFile%
echo DELETE FROM notifications; >> %sqlFile%
echo DELETE FROM user_sessions; >> %sqlFile%
echo DELETE FROM audit_logs; >> %sqlFile%
echo DELETE FROM admin_logs; >> %sqlFile%
echo DELETE FROM backup_logs; >> %sqlFile%
echo DELETE FROM rate_limit_logs; >> %sqlFile%
echo DELETE FROM users; >> %sqlFile%
echo UPDATE system_config SET system_balance = 0, profit_pool = 0; >> %sqlFile%
echo ALTER SEQUENCE users_id_seq RESTART WITH 1; >> %sqlFile%
echo ALTER SEQUENCE quotas_id_seq RESTART WITH 1; >> %sqlFile%
echo ALTER SEQUENCE loans_id_seq RESTART WITH 1; >> %sqlFile%
echo ALTER SEQUENCE transactions_id_seq RESTART WITH 1; >> %sqlFile%
echo ALTER TABLE users ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE quotas ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE loans ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE transactions ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE loan_installments ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE withdrawals ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE user_statistics ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE referrals ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE support_tickets ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE fee_history ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE notifications ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE user_sessions ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE audit_logs ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE admin_logs ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE backup_logs ENABLE TRIGGER ALL; >> %sqlFile%
echo ALTER TABLE rate_limit_logs ENABLE TRIGGER ALL; >> %sqlFile%
echo COMMIT; >> %sqlFile%
echo ANALYZE; >> %sqlFile%

REM Executar o script
docker exec -i cred30-postgres psql -U cred30user -d cred30 < %sqlFile%

if errorlevel 1 (
    echo ❌ FALHA NO APAGAMENTO!
    if exist %sqlFile% del %sqlFile%
    pause
    exit /b 1
)

REM Limpar arquivo temporario
if exist %sqlFile% del %sqlFile%

echo.
echo ✅ APAGAMENTO COMPLETO CONCLUIDO!
echo.
echo 🎯 RESULTADO FINAL:
echo ❌ BANCO 100%% VAZIO
echo ❌ TODOS OS DADOS APAGADOS
echo ❌ INCLUSIVE O ADMINISTRADOR
echo ❌ SISTEMA PRECISA SER REINICIALIZADO
echo.
echo 🔄 PROXIMOS PASSOS:
echo 1. Para recriar o banco completo:
echo    docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql
echo.
echo 2. Para criar um novo admin manualmente:
echo    docker exec -it cred30-postgres psql -U cred30user -d cred30
echo    INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at) 
echo    VALUES ('Seu Nome', 'seu@email.com', 'senha_hash', 'sua@chave.pix', 'sua_frase_secreta', 'CODIGO001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
echo.
echo 3. Backup de emergencia criado:
echo    ./backups/emergency_backup_before_wipe_%TIMESTAMP%.sql.gz
echo.

REM Verificacao final
echo 🔍 Verificando estado final do banco...
for /f "tokens=*" %%a in ('docker exec cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users;"') do set usersCount=%%a
echo Usuarios restantes: %usersCount%

if "%usersCount%"=="0" (
    echo ✅ Confirmacao: Banco esta completamente vazio
) else (
    echo ❌ Alerta: Ainda existem usuarios no banco
)

echo.
echo 🎉 Operacao concluida!
echo.
pause