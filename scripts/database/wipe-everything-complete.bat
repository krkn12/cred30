@echo off
echo =====================================================
echo LIMPEZA COMPLETA E TOTAL DO BANCO DE DADOS - CRED30
echo =====================================================
echo.
echo ATENCAO: Este script IRA APAGAR TUDO do banco de dados!
echo - Todos os usuarios (incluindo admin)
echo - Todas as transacoes e dados financeiros
echo - Todos os logs e configuracoes
echo - TUDO sera removido, deixando apenas a estrutura
echo.
echo Pressione CTRL+C para CANCELAR ou
pause
echo.

echo [1/3] Verificando conexao com o banco de dados...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "SELECT 1 as test_connection;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Nao foi possivel conectar ao banco de dados PostgreSQL
    echo Verifique se o container Docker esta em execucao
    pause
    exit /b 1
)
echo OK: Conexao estabelecida

echo.
echo [2/3] Executando limpeza COMPLETA do banco de dados...
docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/wipe-everything-complete.sql

if %errorlevel% neq 0 (
    echo ERRO: Falha durante a limpeza do banco de dados
    pause
    exit /b 1
)

echo.
echo [3/3] Verificando resultado da limpeza...
docker exec cred30-postgres psql -U cred30user -d cred30 -c "
SELECT 
    'TABELA: ' || tablename || ' - REGISTROS: ' || 
    COALESCE((SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename), 0) || ' colunas, ' ||
    COALESCE((SELECT COUNT(*) FROM pg_stat_user_tables WHERE relname = t.tablename), 0) || ' estatisticas'
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY tablename;
"

echo.
echo =====================================================
echo LIMPEZA COMPLETA CONCLUIDA COM SUCESSO!
echo =====================================================
echo.
echo Status do banco de dados:
echo - Todos os dados foram REMOVIDOS
echo - Apenas a estrutura das tabelas foi mantida
echo - Todas as sequencias foram resetadas
echo - Nenhum usuario ou registro permanece
echo.
echo O sistema esta completamente ZERADO e pronto para um novo inicio!
echo.
echo Para criar um novo admin, execute:
echo docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "
echo INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, is_active, email_verified)
echo VALUES (gen_random_uuid(), 'admin@exemplo.com', 'senha_hash_aqui', 'Administrador', 'admin', NOW(), NOW(), true, true);
echo "
echo.
pause