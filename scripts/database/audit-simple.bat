@echo off
echo =====================================================
echo AUDITORIA SIMPLES DO SISTEMA CRED30
echo =====================================================
echo.

echo [1/5] Verificando containers Docker...
docker ps --format "table {{.Names}}\t{{.Status}}"
echo.

echo [2/5] Verificando banco de dados...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as total_usuarios FROM users;"
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as total_transacoes FROM transactions;"
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as total_admins FROM users WHERE is_admin = true;"
echo.

echo [3/5] Verificando usuarios...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT email, name, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 5;"
echo.

echo [4/5] Verificando configuracoes do sistema...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT * FROM system_config ORDER BY created_at DESC LIMIT 1;"
echo.

echo [5/5] Verificando logs recentes...
echo Backend:
docker logs cred30-backend-single --tail=10 --since=30m
echo Frontend:
docker logs cred30-frontend-single --tail=10 --since=30m
echo PostgreSQL:
docker logs cred30-postgres --tail=10 --since=30m
echo.

echo =====================================================
echo AUDITORIA CONCLUIDA!
echo =====================================================
echo.
echo Resumo:
echo - Verifique se os containers estao rodando
echo - Verifique a contagem de usuarios e transacoes
echo - Verifique se existem usuarios admin
echo - Verifique as configuracoes do sistema
echo - Verifique os logs para erros
echo.
pause