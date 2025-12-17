@echo off
echo ===================================================
echo AUDITORIA COMPLETA DO SISTEMA CRED30 - WINDOWS
echo ===================================================
echo.

echo [1/5] Verificando containers Docker...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [2/5] Verificando estrutura das tabelas criticas...
echo.
echo === Tabela USERS ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "\d users" 2>nul
echo.
echo === Tabela QUOTAS ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "\d quotas" 2>nul
echo.
echo === Tabela TRANSACTIONS ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "\d transactions" 2>nul
echo.
echo === Tabela ADMIN_LOGS ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "\d admin_logs" 2>nul
echo.

echo [3/5] Verificando dados nas tabelas...
echo.
echo === Usuarios ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as total_users FROM users;" 2>nul
echo.
echo === Cotas ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as total_quotas FROM quotas;" 2>nul
echo.
echo === Transacoes ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as total_transactions FROM transactions;" 2>nul
echo.
echo === Admin Logs ===
docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as total_admin_logs FROM admin_logs;" 2>nul
echo.

echo [4/5] Verificando logs do backend...
echo.
echo === Ultimas linhas do backend ===
docker logs --tail 20 cred30-backend 2>nul
echo.

echo [5/5] Testando conexao com API...
echo.
curl -s http://localhost:3001/api/auth/health 2>nul || echo Backend nao respondendo
echo.

echo ===================================================
echo AUDITORIA CONCLUIDA
echo ===================================================
pause