# Script de Auditoria Completa do Sistema CRED30 - Windows PowerShell
# Verifica frontend, backend e banco de dados Docker

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AUDITORIA COMPLETA DO SISTEMA CRED30" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Função para verificar status de containers Docker
function Check-DockerContainers {
    Write-Host "📦 VERIFICANDO CONTAINERS DOCKER..." -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    
    try {
        $containers = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        Write-Host $containers
        Write-Host ""
        
        # Verificar se containers essenciais estão rodando
        $postgres = docker ps --filter "name=postgres" --format "{{.Names}}"
        $redis = docker ps --filter "name=redis" --format "{{.Names}}"
        $backend = docker ps --filter "name=backend" --format "{{.Names}}"
        $frontend = docker ps --filter "name=frontend" --format "{{.Names}}"
        
        Write-Host "Status dos Containers:" -ForegroundColor Green
        Write-Host "  PostgreSQL: $(if ($postgres) { '✅ Rodando' } else { '❌ Parado' })"
        Write-Host "  Redis: $(if ($redis) { '✅ Rodando' } else { '❌ Parado' })"
        Write-Host "  Backend: $(if ($backend) { '✅ Rodando' } else { '❌ Parado' })"
        Write-Host "  Frontend: $(if ($frontend) { '✅ Rodando' } else { '❌ Parado' })"
        
    }
    catch {
        Write-Host "❌ Erro ao verificar containers: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Função para verificar banco de dados
function Check-Database {
    Write-Host "🗄️  VERIFICANDO BANCO DE DADOS..." -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    
    try {
        # Verificar conexão com o banco
        $result = docker exec postgres psql -U postgres -d cred30 -c "SELECT version();" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Conexão com PostgreSQL estabelecida" -ForegroundColor Green
            
            # Verificar tabelas
            Write-Host "`n📋 Tabelas no banco de dados:" -ForegroundColor Cyan
            $tables = docker exec postgres psql -U postgres -d cred30 -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" -t 2>$null
            $tableList = $tables -split "`n" | Where-Object { $_.Trim() -ne "" } | ForEach-Object { $_.Trim() }
            Write-Host "Total de tabelas: $($tableList.Count)" -ForegroundColor White
            $tableList | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
            
            # Verificar contagem de registros
            Write-Host "`n📊 Contagem de registros:" -ForegroundColor Cyan
            $importantTables = @("users", "transactions", "quotas", "loans", "admin_logs", "audit_logs")
            foreach ($table in $importantTables) {
                $count = docker exec postgres psql -U postgres -d cred30 -c "SELECT COUNT(*) FROM $table;" -t 2>$null
                $count = $count.Trim()
                Write-Host "  $table`: $count registros" -ForegroundColor White
            }
            
            # Verificar configuração do sistema
            Write-Host "`n⚙️  Configuração do sistema:" -ForegroundColor Cyan
            $config = docker exec postgres psql -U postgres -d cred30 -c "SELECT system_balance, profit_pool FROM system_config LIMIT 1;" -t 2>$null
            if ($config) {
                $config = $config.Trim() -split "\s+"
                Write-Host "  Saldo do Sistema: R$ $($config[0])" -ForegroundColor White
                Write-Host "  Pool de Lucros: R$ $($config[1])" -ForegroundColor White
            }
            
        }
        else {
            Write-Host "❌ Falha na conexão com PostgreSQL" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ Erro ao verificar banco de dados: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Função para verificar logs de erro
function Check-ErrorLogs {
    Write-Host "🔍 VERIFICANDO LOGS DE ERRO..." -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    
    try {
        # Logs do Backend (últimas 20 linhas)
        Write-Host "📝 Logs do Backend (últimas 20 linhas):" -ForegroundColor Cyan
        $backendLogs = docker logs backend --tail 20 2>&1
        if ($backendLogs) {
            $errorLines = $backendLogs | Where-Object { $_ -match "Error|error|ERROR" }
            if ($errorLines) {
                Write-Host "❌ Erros encontrados:" -ForegroundColor Red
                $errorLines | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
            }
            else {
                Write-Host "✅ Nenhum erro encontrado nos logs recentes" -ForegroundColor Green
            }
        }
        
        # Logs do Frontend (últimas 20 linhas)
        Write-Host "`n📝 Logs do Frontend (últimas 20 linhas):" -ForegroundColor Cyan
        $frontendLogs = docker logs frontend --tail 20 2>&1
        if ($frontendLogs) {
            $errorLines = $frontendLogs | Where-Object { $_ -match "Error|error|ERROR" }
            if ($errorLines) {
                Write-Host "❌ Erros encontrados:" -ForegroundColor Red
                $errorLines | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
            }
            else {
                Write-Host "✅ Nenhum erro encontrado nos logs recentes" -ForegroundColor Green
            }
        }
        
    }
    catch {
        Write-Host "❌ Erro ao verificar logs: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Função para verificar TypeScript
function Check-TypeScript {
    Write-Host "📝 VERIFICANDO COMPILAÇÃO TYPESCRIPT..." -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    
    try {
        Set-Location "packages/backend"
        $tsCheck = npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ TypeScript compilado sem erros" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Erros de TypeScript encontrados:" -ForegroundColor Red
            $tsCheck | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        }
        Set-Location "../../"
    }
    catch {
        Write-Host "❌ Erro ao verificar TypeScript: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Função para verificar acesso às APIs
function Check-APIs {
    Write-Host "🌐 VERIFICANDO ACESSO ÀS APIs..." -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    
    try {
        # Verificar API de saúde do backend
        $backendHealth = try { 
            Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5 
        }
        catch { 
            $null 
        }
        
        if ($backendHealth) {
            Write-Host "✅ Backend API respondendo" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Backend API não respondendo" -ForegroundColor Red
        }
        
        # Verificar Frontend
        $frontendHealth = try { 
            Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 5 
        }
        catch { 
            $null 
        }
        
        if ($frontendHealth) {
            Write-Host "✅ Frontend respondendo" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Frontend não respondendo" -ForegroundColor Red
        }
        
    }
    catch {
        Write-Host "❌ Erro ao verificar APIs: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Função para verificar uso de recursos
function Check-Resources {
    Write-Host "💻 VERIFICANDO USO DE RECURSOS..." -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    
    try {
        # Verificar uso de memória e CPU dos containers
        $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        Write-Host $stats
        
        # Verificar espaço em disco
        $disk = Get-PSDrive C
        Write-Host "`n💾 Espaço em disco:" -ForegroundColor Cyan
        Write-Host "  Drive C: $($disk.Used / 1GB)GB usado de $($disk.Size / 1GB)GB ($([math]::Round(($disk.Used / $disk.Size) * 100, 2))%)" -ForegroundColor White
        
    }
    catch {
        Write-Host "❌ Erro ao verificar recursos: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Executar todas as verificações
Check-DockerContainers
Check-Database
Check-ErrorLogs
Check-TypeScript
Check-APIs
Check-Resources

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "           AUDITORIA CONCLUÍDA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Resumo final
Write-Host "📋 RESUMO DA AUDITORIA:" -ForegroundColor Yellow
Write-Host "  • Containers Docker verificados" -ForegroundColor Gray
Write-Host "  • Banco de dados analisado" -ForegroundColor Gray
Write-Host "  • Logs de erro verificados" -ForegroundColor Gray
Write-Host "  • Compilação TypeScript testada" -ForegroundColor Gray
Write-Host "  • APIs acessibilidade verificada" -ForegroundColor Gray
Write-Host "  • Recursos do sistema monitorados" -ForegroundColor Gray
Write-Host ""

Write-Host "Se houver erros, eles serão listados acima em vermelho." -ForegroundColor Yellow
Write-Host "Se tudo estiver verde, o sistema esta funcionando corretamente!" -ForegroundColor Green