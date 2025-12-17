@echo off
chcp 65001 >nul
echo TESTANDO CORRECAO DO ERRO DE UUID...
echo ========================================

echo Parando backend atual...
docker stop cred30-backend-single

echo Aguardando 5 segundos...
timeout /t 5 /nobreak >nul

echo Reiniciando backend com correcoes...
docker start cred30-backend-single

echo Aguardando backend iniciar...
timeout /t 10 /nobreak >nul

echo Verificando logs do backend...
docker logs cred30-backend-single --tail 20

echo.
echo Teste concluido! Verifique se o erro de UUID ainda ocorre.
echo.
pause