# =============================================================================
# VERSÃO OTIMIZADA POWERSHELL - LIMPEZA COMPLETA DIRETA NO DOCKER
# =============================================================================

# Cores
$colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
    White = "White"
}

# Tempo de início
$startTime = Get-Date

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $colors[$Color]
}

Write-ColorOutput "============================================================================" "Red"
Write-ColorOutput "LIMPEZA COMPLETA OTIMIZADA - VERSÃO RÁPIDA (POWERSHELL)" "Red"
Write-ColorOutput "============================================================================" "Red"
Write-ColorOutput ""
Write-ColorOutput "🚨 ATENÇÃO: ESTE COMANDO APAGARÁ 100% DE TODOS OS DADOS! 🚨" "Red"
Write-ColorOutput "🚨 INCLUSIVE O ADMINISTRADOR E TODAS AS CONFIGURAÇÕES! 🚨" "Red"
Write-ColorOutput "🚨 O BANCO FICARÁ COMPLETAMENTE VAZIO! 🚨" "Red"
Write-ColorOutput ""
Write-ColorOutput "Para confirmar, digite: APAGAR_TUDO" "Yellow"
Write-ColorOutput "Ou pressione Ctrl+C para cancelar" "Yellow"
Write-ColorOutput ""

$confirmation = Read-Host "Confirmação"

if ($confirmation -ne "APAGAR_TUDO") {
    Write-ColorOutput "❌ Operação cancelada." "Red"
    exit 1
}

Write-ColorOutput ""
Write-ColorOutput "✅ Iniciando apagamento TOTAL OTIMIZADO..." "Green"
Write-ColorOutput ""

# Verificar se o Docker está rodando
Write-ColorOutput "🔍 Verificando Docker..." "Blue"
try {
    $dockerTest = docker ps 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker não está rodando"
    }
} catch {
    Write-ColorOutput "❌ Docker não está rodando ou não há permissão" "Red"
    Write-ColorOutput "Por favor, inicie o Docker Desktop" "Red"
    exit 1
}

# Verificar se o container PostgreSQL está rodando
Write-ColorOutput "🔍 Verificando container PostgreSQL..." "Blue"
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Where-Object { $_ -ne "" }

if ([string]::IsNullOrEmpty($postgresContainer)) {
    Write-ColorOutput "❌ Container PostgreSQL não encontrado em execução" "Red"
    Write-ColorOutput "Verifique se o container está rodando com: docker ps" "Red"
    exit 1
}

Write-ColorOutput "✅ Container PostgreSQL encontrado: $postgresContainer" "Green"

# Comandos SQL otimizados - usando DROP e RECREATE em vez de TRUNCATE
$sqlCommands = @"
-- Desabilitar todas as constraints e triggers para máxima velocidade
SET session_replication_role = replica;
SET session_replication_role = replica;
SET session_replication_role = replica;

-- Dropar todas as tabelas (muito mais rápido que TRUNCATE para limpeza completa)
DROP TABLE IF EXISTS loan_installments CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS quotas CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS rate_limit_logs CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- Dropar tabelas adicionais que possam existir
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS referral_bonuses CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS support_responses CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS user_statistics CASCADE;
DROP TABLE IF EXISTS system_fees CASCADE;
DROP TABLE IF EXISTS fee_history CASCADE;
DROP TABLE IF EXISTS backup_logs CASCADE;

-- Reabilitar constraints
SET session_replication_role = DEFAULT;

-- Limpar todas as sequências de uma vez
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || r.sequence_name || ' CASCADE';
    END LOOP;
END
\$\$;

-- Confirmar que tudo foi removido
SELECT 'TODAS AS TABELAS FORAM REMOVIDAS COM SUCESSO' as status;
"@

# Executar os comandos de forma otimizada
Write-ColorOutput "🔸 Executando limpeza completa otimizada..." "Yellow"
Write-ColorOutput "⚡ Usando DROP em vez de TRUNCATE para máxima velocidade" "Blue"

# Usar try-catch com timeout
try {
    # Executar com timeout de 60 segundos
    $job = Start-Job -ScriptBlock {
        param($container, $user, $db, $sql)
        docker exec $container psql -U $user -d $db -q -v ON_ERROR_STOP=1 <<< $sql
    } -ArgumentList $postgresContainer, "cred30user", "cred30", $sqlCommands
    
    # Aguardar com timeout
    $completed = Wait-Job $job -Timeout 60
    
    if (-not $completed) {
        Remove-Job $job -Force
        throw "Timeout de 60 segundos excedido"
    }
    
    $result = Receive-Job $job
    Remove-Job $job
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput ""
        Write-ColorOutput "✅ LIMPEZA COMPLETA REALIZADA COM SUCESSO!" "Green"
        
        # Tempo decorrido
        $endTime = Get-Date
        $elapsed = $endTime - $startTime
        Write-ColorOutput "⏱️ Tempo total: $($elapsed.TotalSeconds.ToString('F2')) segundos" "Blue"
        Write-ColorOutput ""
        
        Write-ColorOutput "🎯 RESULTADO:" "Red"
        Write-ColorOutput "✅ BANCO 100% VAZIO" "Red"
        Write-ColorOutput "✅ TODAS AS TABELAS REMOVIDAS" "Red"
        Write-ColorOutput "✅ TODAS AS SEQUÊNCIAS RESETADAS" "Red"
        Write-ColorOutput "✅ SISTEMA PRECISA SER REINICIALIZADO" "Red"
        Write-ColorOutput ""
        
        Write-ColorOutput "🔄 PRÓXIMOS PASSOS:" "Blue"
        Write-ColorOutput "1. Para recriar o banco COMPLETO (recomendado):" "Yellow"
        Write-ColorOutput "   .\create-missing-tables-docker.ps1" "Green"
        Write-ColorOutput "2. Ou para recriar apenas o básico:" "Yellow"
        Write-ColorOutput "   docker exec -i $postgresContainer psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql" "Green"
        Write-ColorOutput "3. Acesse a aplicação e crie o primeiro admin" "Yellow"
        Write-ColorOutput ""
    } else {
        throw "Erro na execução do comando SQL"
    }
} catch {
    Write-ColorOutput "❌ Falha na execução da limpeza!" "Red"
    Write-ColorOutput "Tentando método alternativo..." "Yellow"
    
    # Método alternativo mais agressivo
    $sqlAlt = @"
    -- Desconectar todas as sessões exceto a atual
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = 'cred30';
    
    -- Dropar schema public e recriar
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
    "@
    
    try {
        $result = docker exec $postgresContainer psql -U postgres -d cred30 -q <<< $sqlAlt
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Método alternativo funcionou! Schema recriado." "Green"
        } else {
            throw "Método alternativo também falhou"
        }
    } catch {
        Write-ColorOutput "❌ Falha completa. Verifique manualmente." "Red"
        Write-ColorOutput "Comandos para verificação manual:" "Yellow"
        Write-ColorOutput "docker exec -it $postgresContainer psql -U postgres -d cred30" "Gray"
        Write-ColorOutput "\dt" "Gray"
        exit 1
    }
}

Write-ColorOutput "🎉 Operação concluída!" "Green"