@echo off
echo =====================================================
echo AUDITORIA COMPLETA DO SISTEMA CRED30 - WINDOWS
echo =====================================================
echo.
echo [1/5] Verificando status dos containers Docker...
docker ps --format "table {{.Names}}\t{{.Status}}"

echo.
echo [2/5] Verificando banco de dados PostgreSQL...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT 
    'TABELA: ' || schemaname || '.' || tablename || ' - REGISTROS: ' || 
    COALESCE((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename), 0) || ' colunas'
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY tablename;
"

echo.
echo [3/5] Verificando usuarios no banco de dados...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT 
    id, 
    email, 
    name, 
    is_admin, 
    role, 
    balance, 
    created_at,
    CASE WHEN is_admin THEN 'ADMIN' ELSE 'CLIENTE' END as tipo_usuario
FROM users 
ORDER BY created_at DESC;
"

echo.
echo [4/5] Verificando configuracoes do sistema...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT 
    system_balance,
    profit_pool,
    quota_price,
    loan_interest_rate,
    penalty_rate,
    vesting_period_ms,
    created_at
FROM system_config 
ORDER BY created_at DESC 
LIMIT 1;
"

echo.
echo [5/5] Verificando transacoes recentes...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT 
    t.id,
    t.type,
    t.amount,
    t.status,
    t.created_at,
    u.email as user_email,
    u.name as user_name
FROM transactions t
LEFT JOIN users u ON t.user_id = u.id
ORDER BY t.created_at DESC 
LIMIT 10;
"

echo.
echo =====================================================
echo AUDITORIA CONCLUIDA!
echo =====================================================
echo.
echo Verificando logs de erros do backend...
docker logs cred30-backend-single --tail=20 --since=1h

echo.
echo Verificando logs do frontend...
docker logs cred30-frontend-single --tail=20 --since=1h

echo.
echo Verificando logs do PostgreSQL...
docker logs cred30-postgres --tail=20 --since=1h

echo.
echo =====================================================
echo RESUMO DA AUDITORIA
echo =====================================================
echo.
echo 1. Containers Docker: Verifique se todos estao 'Up'
echo 2. Banco de Dados: Verifique estrutura e contagem de registros
echo 3. Usuarios: Verifique se existem usuarios cadastrados
echo 4. Configuracoes: Verifique valores do sistema
echo 5. Transacoes: Verifique operacoes recentes
echo 6. Logs: Verifique se ha erros ou warnings
echo.
echo Se tudo estiver correto, o sistema esta pronto para uso!
echo.
pause