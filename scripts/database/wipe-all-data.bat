@echo off
echo ========================================
echo   LIMPANDO TODOS OS DADOS - CRED30
echo ========================================
echo.

echo ATENÇÃO: Esta operação é IRREVERSÍVEL!
echo Todos os dados do banco serão REMOVIDOS.
echo Apenas o admin principal será mantido.
echo.

set /p confirm=
set /p confirm2=Tem certeza que deseja continuar? (S/N)

if /i not "%confirm2%"=="S" (
    echo.
    echo Operação cancelada pelo usuário.
    pause
    exit /b 0
)

echo.
echo Iniciando limpeza completa do banco de dados...
echo.

REM Executar script de limpeza corrigido no Docker
docker exec -i cred30-postgres psql -U cred30user -d cred30 -f - < scripts/database/wipe-all-data-fixed.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo      LIMPEZA CONCLUÍDA COM SUCESSO!
    echo ========================================
    echo.
    echo Status do banco:
    echo - Apenas admin principal mantido
    echo - Todas as sequências resetadas
    echo - Configurações padrão restauradas
    echo - Sistema pronto para novo início
    echo.
) else (
    echo.
    echo ========================================
    echo         ERRO NA LIMPEZA!
    echo ========================================
    echo.
    echo Código de erro: %ERRORLEVEL%
    echo Verifique o log acima para detalhes.
    echo.
    pause
    exit /b 1
)

echo.
echo === VERIFICAÇÃO FINAL ===
echo Verificando status final do banco...
echo.

docker exec -i cred30-postgres psql -U cred30user -d cred30 -c "SELECT COUNT(*) as usuarios_mantidos FROM users WHERE email = 'josiassm701@gmail.com';"

echo.
echo ========================================
echo           PROCESSO CONCLUÍDO
echo ========================================
pause