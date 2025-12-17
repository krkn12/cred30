# Script PowerShell para iniciar o CRED30 com ngrok único
# Este script configura o ambiente com proxy reverso para usar apenas um túnel ngrok

Write-Host "🚀 Iniciando CRED30 com ngrok único..." -ForegroundColor Green

# Verificar se ngrok está instalado
try {
    $ngrokVersion = ngrok version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "ngrok não encontrado"
    }
    Write-Host "✅ ngrok encontrado: $ngrokVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ ngrok não encontrado. Por favor, instale o ngrok:" -ForegroundColor Red
    Write-Host "   - Via npm: npm install -g ngrok" -ForegroundColor Yellow
    Write-Host "   - Ou baixe de https://ngrok.com/download" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Verificar se Docker está rodando
try {
    $dockerInfo = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker não está rodando"
    }
    Write-Host "✅ Docker está rodando" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker não está rodando. Por favor, inicie o Docker Desktop." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Parar containers existentes
Write-Host "🛑 Parando containers existentes..." -ForegroundColor Yellow
docker compose -f docker-compose.single-ngrok.yml down --remove-orphans

# Perguntar sobre limpeza de dados
$cleanup = Read-Host "Deseja limpar dados antigos? (s/N)"
if ($cleanup -eq 's' -or $cleanup -eq 'S') {
    Write-Host "🧹 Limpando volumes..." -ForegroundColor Yellow
    docker volume rm cred30_postgres_data cred30_redis_data 2>$null
}

# Iniciar containers
Write-Host "🐳 Iniciando containers com proxy reverso..." -ForegroundColor Yellow
docker compose -f docker-compose.single-ngrok.yml up -d

# Aguardar serviços iniciarem
Write-Host "⏳ Aguardando serviços iniciarem..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Verificar se serviços estão saudáveis
Write-Host "🔍 Verificando saúde dos serviços..." -ForegroundColor Yellow
docker compose -f docker-compose.single-ngrok.yml ps

# Testar frontend
Write-Host "🧪 Testando frontend..." -ForegroundColor Yellow
try {
    $frontendTest = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 10 -UseBasicParsing
    if ($frontendTest.StatusCode -eq 200) {
        Write-Host "✅ Frontend está funcionando!" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️ Frontend pode não estar totalmente pronto. Aguardando mais..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20
}

# Testar backend via proxy
Write-Host "🧪 Testando backend via proxy..." -ForegroundColor Yellow
try {
    $backendTest = Invoke-WebRequest -Uri "http://localhost:5173/api/health" -TimeoutSec 10 -UseBasicParsing
    if ($backendTest.StatusCode -eq 200) {
        Write-Host "✅ Backend está funcionando via proxy!" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️ Backend pode não estar totalmente pronto. Aguardando mais..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20
}

# Popular dados de teste
Write-Host "🌱 Populando dados de teste..." -ForegroundColor Yellow
Set-Location backend
try {
    node scripts/populate-test-data.js
    Write-Host "✅ Dados de teste populados!" -ForegroundColor Green
}
catch {
    Write-Host "⚠️ Erro ao popular dados: $($_.Exception.Message)" -ForegroundColor Yellow
}
Set-Location ..

# Iniciar ngrok para frontend (com proxy para backend)
Write-Host "🌐 Iniciando ngrok para frontend (com proxy reverso)..." -ForegroundColor Yellow
Start-Process -FilePath "ngrok" -ArgumentList "http", "5173", "--log=stdout" -WindowStyle Minimized

# Aguardar ngrok inicializar
Write-Host "⏳ Aguardando ngrok inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Tentar obter URL do ngrok
try {
    $ngrokInfo = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing | ConvertFrom-Json
    $ngrokUrl = $ngrokInfo.tunnels[0].public_url
    Write-Host ""
    Write-Host "🎉 CRED30 está online com ngrok único!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Acesso Completo (Frontend + Backend via proxy):" -ForegroundColor Cyan
    Write-Host "   Local: http://localhost:5173" -ForegroundColor White
    Write-Host "   Externo: $ngrokUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Endpoints disponíveis:" -ForegroundColor Cyan
    Write-Host "   Frontend: $ngrokUrl" -ForegroundColor White
    Write-Host "   API: $ngrokUrl/api" -ForegroundColor White
    Write-Host "   Dashboard Admin: $ngrokUrl/admin" -ForegroundColor White
    Write-Host ""
    Write-Host "👥 Usuários para teste:" -ForegroundColor Cyan
    Write-Host "   Admin: admin@cred30.com / admin123" -ForegroundColor White
    Write-Host "   Cliente: joao@cred30.com / cliente123" -ForegroundColor White
    Write-Host ""
    Write-Host "🛠️ Comandos úteis:" -ForegroundColor Cyan
    Write-Host "   Ver logs: docker compose -f docker-compose.single-ngrok.yml logs -f" -ForegroundColor White
    Write-Host "   Parar tudo: docker compose -f docker-compose.single-ngrok.yml down" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  Mantenha esta janela aberta para manter o ngrok ativo." -ForegroundColor Yellow
    Write-Host "   Pressione Ctrl+C para parar tudo." -ForegroundColor Yellow
    Write-Host ""
    
    # Manter script rodando
    try {
        while ($true) {
            Start-Sleep -Seconds 1
        }
    }
    finally {
        Write-Host ""
        Write-Host "🛑 Parando serviços..." -ForegroundColor Yellow
        docker compose -f docker-compose.single-ngrok.yml down
        Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process
        Write-Host "✅ Serviços parados." -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️ Não foi possível obter URL do ngrok. Verifique a janela do ngrok." -ForegroundColor Yellow
    Write-Host "   URL provável: https://[random].ngrok-free.app" -ForegroundColor White
    Write-Host ""
    Write-Host "Pressione Enter para sair..." -ForegroundColor Yellow
    Read-Host
}