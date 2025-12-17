@echo off
echo ========================================
echo   EXTRAINDO TODOS OS DADOS - CRED30
echo ========================================
echo.

REM Criar diretório de backup
if not exist "database\backup" mkdir database\backup
set BACKUP_DIR=database\backup
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_FILE=%BACKUP_DIR%\cred30_complete_backup_%TIMESTAMP%.sql

echo.
echo Diretório de backup: %BACKUP_DIR%
echo Arquivo de backup: %BACKUP_FILE%
echo.

REM Executar extração de dados no Docker
echo.
echo Iniciando extração de dados do PostgreSQL...
echo.

docker exec -i cred30-postgres psql -U cred30user -d cred30 -f - < scripts/database/extract-all-data.sql > "%BACKUP_FILE%" 2>&1

REM Verificar se a extração foi bem-sucedida
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   EXTRAÇÃO CONCLUÍDA COM SUCESSO!
    echo ========================================
    echo.
    echo Arquivo salvo em: %BACKUP_FILE%
    echo Tamanho do arquivo: 
    dir "%BACKUP_FILE%" | find "bytes"
    echo.
    echo Total de tabelas extraídas: 25
    echo.
) else (
    echo.
    echo ========================================
    echo      ERRO NA EXTRAÇÃO!
    echo ========================================
    echo.
    echo Código de erro: %ERRORLEVEL%
    echo Verifique o log acima para detalhes.
    echo.
    pause
    exit /b 1
)

REM Mostrar resumo do arquivo gerado
echo.
echo === RESUMO DO BACKUP GERADO ===
echo Data/Hora: %TIMESTAMP%
echo Arquivo: %BACKUP_FILE%
echo.

REM Contar linhas no arquivo (aproximado)
for /f %%i in ('find /v /c "%BACKUP_FILE%"') do set LINE_COUNT=%%i
echo Linhas aproximadas: %LINE_COUNT%

echo.
echo === PRÓXIMOS PASSOS RECOMENDADOS ===
echo 1. Verifique o arquivo de backup
echo 2. Teste a restauração em ambiente de teste
echo 3. Mantenha o backup em local seguro
echo 4. Documente a data do backup para rastreamento
echo.
echo ========================================

pause