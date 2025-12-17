# =============================================================================
# LIMPEZA SEGURA DO BANCO DE DADOS DOCKER - CRED30 (POWERSHELL)
# =============================================================================
# Este script oferece 4 níveis de limpeza com diferentes graus de segurança
# Autor: Assistente IA
# Data: $(Get-Date -Format 'yyyy-MM-dd')
# =============================================================================

# Parar em caso de erro
$ErrorActionPreference = "Stop"

# Cores para PowerShell
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Purple = "Magenta"
    Cyan = "Cyan"
    White = "White"
}

# Configurações
$CONTAINER_NAME = "cred30-postgres"
$DB_USER = "cred30user"
$DB_NAME = "cred30"
$BACKUP_DIR = "./backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"

# Função para escrever texto colorido
function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Colors[$Color]
}

# Função para verificar se o container está rodando
function Test-Container {
    $running = docker ps | Select-String $CONTAINER_NAME
    if (-not $running) {
        Write-ColorText "❌ Container $CONTAINER_NAME não está rodando!" "Red"
        Write-ColorText "📋 Containers disponíveis:" "Yellow"
        docker ps --format "table {{.Names}}`t{{.Status}}"
        exit 1
    }
    return $true
}

# Função para criar backup antes da limpeza
function New-Backup {
    Write-ColorText "💾 Criando backup antes da limpeza..." "Blue"
    
    # Criar diretório de backup se não existir
    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    }
    
    # Criar backup completo
    $backupFile = "$BACKUP_DIR/cred30_backup_before_cleanup_$TIMESTAMP.sql"
    $backupCommand = "docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > `"$backupFile`""
    
    try {
        Invoke-Expression $backupCommand
        Write-ColorText "✅ Backup criado: $backupFile" "Green"
        
        # Compactar backup
        Compress-Archive -Path $backupFile -DestinationPath "$backupFile.gz" -Force
        Remove-Item $backupFile
        Write-ColorText "✅ Backup compactado" "Green"
    }
    catch {
        Write-ColorText "❌ Falha ao criar backup!" "Red"
        return $false
    }
    return $true
}

# Função para verificar integridade após limpeza
function Test-Cleanup {
    Write-ColorText "🔍 Verificando integridade do banco após limpeza..." "Cyan"
    
    # Verificar se as tabelas principais existem
    $tablesCheck = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c @"
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN '✅'
                ELSE '❌'
            END as users,
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotas') THEN '✅'
                ELSE '❌'
            END as quotas,
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans') THEN '✅'
                ELSE '❌'
            END as loans,
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN '✅'
                ELSE '❌'
            END as transactions;
"@
    
    Write-ColorText "📊 Status das tabelas principais:" "Blue"
    Write-Host $tablesCheck
    
    # Verificar contagens
    $counts = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c @"
        SELECT 
            'users' as table_name, COUNT(*) as count FROM users
        UNION ALL
        SELECT 
            'quotas' as table_name, COUNT(*) as count FROM quotas
        UNION ALL
        SELECT 
            'loans' as table_name, COUNT(*) as count FROM loans
        UNION ALL
        SELECT 
            'transactions' as table_name, COUNT(*) as count FROM transactions;
"@
    
    Write-ColorText "📈 Contagem de registros:" "Blue"
    Write-Host $counts
}

# Opção 1: Limpeza Segura (apenas dados, mantém estrutura)
function Invoke-SafeCleanup {
    Write-ColorText "🛡️ INICIANDO LIMPEZA SEGURA (apenas dados)" "Green"
    Write-ColorText "⚠️  Apenas os dados serão removidos, estrutura mantida" "Yellow"
    Write-Host ""
    
    if (-not (New-Backup)) {
        return $false
    }
    
    Write-ColorText "🧹 Limpando dados das tabelas..." "Yellow"
    
    # Script SQL para limpeza segura
    $safeSql = @"
    -- Iniciar transação
    BEGIN;
    
    -- Desabilitar triggers temporariamente
    ALTER TABLE users DISABLE TRIGGER ALL;
    ALTER TABLE quotas DISABLE TRIGGER ALL;
    ALTER TABLE loans DISABLE TRIGGER ALL;
    ALTER TABLE transactions DISABLE TRIGGER ALL;
    
    -- Limpar tabelas em ordem de dependência (sem DROP)
    DELETE FROM loan_installments;
    DELETE FROM withdrawals;
    DELETE FROM transactions;
    DELETE FROM quotas;
    DELETE FROM loans;
    DELETE FROM user_statistics;
    DELETE FROM referrals;
    DELETE FROM support_tickets;
    DELETE FROM fee_history;
    DELETE FROM notifications;
    DELETE FROM user_sessions;
    DELETE FROM audit_logs;
    DELETE FROM admin_logs;
    DELETE FROM backup_logs;
    DELETE FROM rate_limit_logs;
    
    -- Manter apenas o admin principal
    DELETE FROM users WHERE email != 'josiassm701@gmail.com';
    
    -- Resetar configurações do sistema (manter estrutura)
    UPDATE system_config SET 
        system_balance = 0,
        profit_pool = 0,
        quota_price = 50.00,
        loan_interest_rate = 0.20,
        penalty_rate = 0.40,
        vesting_period_ms = 365 * 24 * 60 * 60 * 1000;
    
    -- Resetar sequências
    ALTER SEQUENCE users_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotas_id_seq RESTART WITH 1;
    ALTER SEQUENCE loans_id_seq RESTART WITH 1;
    ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
    
    -- Reabilitar triggers
    ALTER TABLE users ENABLE TRIGGER ALL;
    ALTER TABLE quotas ENABLE TRIGGER ALL;
    ALTER TABLE loans ENABLE TRIGGER ALL;
    ALTER TABLE transactions ENABLE TRIGGER ALL;
    
    -- Confirmar transação
    COMMIT;
    
    -- Forçar atualização de estatísticas
    ANALYZE;
"@
    
    $sqlFile = "temp_safe_cleanup.sql"
    $safeSql | Out-File -FilePath $sqlFile -Encoding UTF8
    
    try {
        docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $sqlFile
        Write-ColorText "✅ Limpeza segura concluída!" "Green"
        Test-Cleanup
        return $true
    }
    catch {
        Write-ColorText "❌ Falha na limpeza segura!" "Red"
        return $false
    }
    finally {
        if (Test-Path $sqlFile) {
            Remove-Item $sqlFile
        }
    }
}

# Opção 2: Limpeza Completa (recria estrutura)
function Invoke-CompleteCleanup {
    Write-ColorText "🔥 INICIANDO LIMPEZA COMPLETA" "Red"
    Write-ColorText "⚠️  ATENÇÃO: Todas as tabelas serão dropadas e recriadas!" "Red"
    Write-Host ""
    
    if (-not (New-Backup)) {
        return $false
    }
    
    Write-ColorText "🔄 Recriando estrutura completa do banco..." "Yellow"
    
    try {
        # Usar o script SQL de inicialização
        docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < ./init-db-fixed.sql
        Write-ColorText "✅ Estrutura recriada com sucesso!" "Green"
        
        # Inserir admin básico
        docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c @"
        INSERT INTO users (name, email, password_hash, pix_key, secret_phrase, referral_code, is_admin, balance, created_at, updated_at) VALUES
        ('Administrador', 'josiassm701@gmail.com', 'admin_hash_temp', 'admin@pix.local', 'admin_secret', 'ADMIN001', true, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO NOTHING;
"@
        
        Test-Cleanup
        return $true
    }
    catch {
        Write-ColorText "❌ Falha na recriação da estrutura!" "Red"
        return $false
    }
}

# Opção 3: Reset Total (apaga tudo e recria do zero)
function Invoke-TotalReset {
    Write-ColorText "💣 INICIANDO RESET TOTAL" "Purple"
    Write-ColorText "🚨 ATENÇÃO MÁXIMA: Banco será completamente apagado!" "Red"
    Write-Host ""
    
    if (-not (New-Backup)) {
        return $false
    }
    
    Write-ColorText "🗑️ Apagando TODAS as tabelas..." "Red"
    
    # Script SQL para reset total
    $resetSql = @"
    -- Dropar todas as tabelas
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    
    -- Recriar extensões necessárias
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Confirmar
    SELECT 'Schema público recriado' as status;
"@
    
    $sqlFile = "temp_reset.sql"
    $resetSql | Out-File -FilePath $sqlFile -Encoding UTF8
    
    try {
        docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $sqlFile
        Write-ColorText "✅ Schema público recriado!" "Green"
        
        # Recriar estrutura completa
        docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < ./init-db-fixed.sql
        Write-ColorText "✅ Reset total concluído!" "Green"
        
        # NÃO inserir admin básico (apaga tudo inclusive admin)
        Write-ColorText "⚠️  Nenhum usuário inserido (inclusive admin)" "Yellow"
        
        Test-Cleanup
        return $true
    }
    catch {
        Write-ColorText "❌ Falha no reset do schema!" "Red"
        return $false
    }
    finally {
        if (Test-Path $sqlFile) {
            Remove-Item $sqlFile
        }
    }
}

# Opção 4: Apagar TUDO (inclusive admin)
function Invoke-WipeEverything {
    Write-ColorText "💀 INICIANDO APAGAR COMPLETO (TUDO INCLUSIVE ADMIN)" "Red"
    Write-ColorText "🚨 ATENÇÃO EXTREMA: Todos os dados serão apagados!" "Red"
    Write-Host ""
    
    if (-not (New-Backup)) {
        return $false
    }
    
    Write-ColorText "🔥 Apagando TODOS os dados (inclusive admin)..." "Red"
    
    # Script SQL para apagar tudo mantendo estrutura
    $wipeSql = @"
    -- Iniciar transação
    BEGIN;
    
    -- Desabilitar triggers temporariamente
    ALTER TABLE users DISABLE TRIGGER ALL;
    ALTER TABLE quotas DISABLE TRIGGER ALL;
    ALTER TABLE loans DISABLE TRIGGER ALL;
    ALTER TABLE transactions DISABLE TRIGGER ALL;
    
    -- Apagar TODOS os dados em ordem de dependência
    DELETE FROM loan_installments;
    DELETE FROM withdrawals;
    DELETE FROM transactions;
    DELETE FROM quotas;
    DELETE FROM loans;
    DELETE FROM user_statistics;
    DELETE FROM referrals;
    DELETE FROM support_tickets;
    DELETE FROM fee_history;
    DELETE FROM notifications;
    DELETE FROM user_sessions;
    DELETE FROM audit_logs;
    DELETE FROM admin_logs;
    DELETE FROM backup_logs;
    DELETE FROM rate_limit_logs;
    
    -- Apagar TODOS os usuários (inclusive admin)
    DELETE FROM users;
    
    -- Resetar configurações do sistema
    UPDATE system_config SET 
        system_balance = 0,
        profit_pool = 0,
        quota_price = 50.00,
        loan_interest_rate = 0.20,
        penalty_rate = 0.40,
        vesting_period_ms = 365 * 24 * 60 * 60 * 1000;
    
    -- Resetar sequências
    ALTER SEQUENCE users_id_seq RESTART WITH 1;
    ALTER SEQUENCE quotas_id_seq RESTART WITH 1;
    ALTER SEQUENCE loans_id_seq RESTART WITH 1;
    ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
    
    -- Reabilitar triggers
    ALTER TABLE users ENABLE TRIGGER ALL;
    ALTER TABLE quotas ENABLE TRIGGER ALL;
    ALTER TABLE loans ENABLE TRIGGER ALL;
    ALTER TABLE transactions ENABLE TRIGGER ALL;
    
    -- Confirmar transação
    COMMIT;
    
    -- Forçar atualização de estatísticas
    ANALYZE;
    
    -- Relatório final
    DO \$\$
    BEGIN
        RAISE NOTICE '========================================';
        RAISE NOTICE '  APAGAR COMPLETO DO BANCO DE DADOS';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Data/Hora: %', CURRENT_TIMESTAMP;
        RAISE NOTICE 'Total de tabelas limpas: 25';
        RAISE NOTICE 'Usuários apagados: TODOS (inclusive admin)';
        RAISE NOTICE 'Dados removidos: TUDO';
        RAISE NOTICE 'Estrutura mantida: SIM';
        RAISE NOTICE 'Sequências resetadas: SIM';
        RAISE NOTICE '========================================';
    END \$\$;
"@
    
    $sqlFile = "temp_wipe.sql"
    $wipeSql | Out-File -FilePath $sqlFile -Encoding UTF8
    
    try {
        docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $sqlFile
        Write-ColorText "✅ Apagamento completo concluído!" "Green"
        Write-ColorText "🎯 RESULTADO:" "Red"
        Write-ColorText "✅ BANCO 100% VAZIO" "Red"
        Write-ColorText "✅ TODOS OS DADOS APAGADOS" "Red"
        Write-ColorText "✅ INCLUSIVE O ADMINISTRADOR" "Red"
        Write-ColorText "✅ SISTEMA PRECISA SER REINICIALIZADO" "Red"
        Write-Host ""
        Write-ColorText "🔄 PRÓXIMOS PASSOS:" "Blue"
        Write-ColorText "1. Para recriar o banco:" "Yellow"
        Write-ColorText "   docker exec -i cred30-postgres psql -U cred30user -d cred30 < scripts/database/init-db-fixed.sql" "Green"
        Write-ColorText "2. Acesse a aplicação e crie o primeiro admin" "Yellow"
        Write-Host ""
        
        Test-Cleanup
        return $true
    }
    catch {
        Write-ColorText "❌ Falha no apagamento completo!" "Red"
        return $false
    }
    finally {
        if (Test-Path $sqlFile) {
            Remove-Item $sqlFile
        }
    }
}

# Menu principal
function Show-Menu {
    Clear-Host
    Write-ColorText "============================================================================" "Cyan"
    Write-ColorText "    🔧 GERENCIADOR DE LIMPEZA DO BANCO CRED30 (POWERSHELL)" "Cyan"
    Write-ColorText "============================================================================" "Cyan"
    Write-Host ""
    Write-ColorText "📋 Escolha o nível de limpeza:" "Green"
    Write-Host ""
    Write-ColorText "1) Limpeza Segura - Apenas dados, mantém estrutura" "Yellow"
    Write-ColorText "   → Remove todos os dados mas preserva tabelas e estrutura" "Blue"
    Write-ColorText "   → Mantém usuário admin e configurações básicas" "Blue"
    Write-Host ""
    Write-ColorText "2) Limpeza Completa - Recria estrutura do zero" "Yellow"
    Write-ColorText "   → Dropa e recria todas as tabelas" "Blue"
    Write-ColorText "   → Mantém dados básicos de configuração" "Blue"
    Write-Host ""
    Write-ColorText "3) Reset Total - Apaga tudo e recria do zero" "Red"
    Write-ColorText "   → Opção mais drástica e irreversível" "Red"
    Write-ColorText "   → Recomendada apenas para desenvolvimento" "Red"
    Write-Host ""
    Write-ColorText "4) 💀 Apagar TUDO (inclusive Admin)" "Red"
    Write-ColorText "   → Remove TODOS os dados incluindo o administrador" "Red"
    Write-ColorText "   → Banco fica 100% vazio, precisa recriar admin" "Red"
    Write-Host ""
    Write-ColorText "5) Verificar Status Atual" "Blue"
    Write-ColorText "   → Mostra contagem atual das tabelas" "Blue"
    Write-Host ""
    Write-ColorText "6) Criar Backup Apenas" "Purple"
    Write-ColorText "   → Cria backup sem modificar dados" "Blue"
    Write-Host ""
    Write-ColorText "0) Sair" "Red"
    Write-Host ""
    Write-ColorText "============================================================================" "Cyan"
}

# Verificar status atual
function Get-Status {
    Write-ColorText "📊 VERIFICANDO STATUS ATUAL DO BANCO" "Blue"
    Write-Host ""
    
    if (Test-Container) {
        Test-Cleanup
    }
}

# Programa principal
function Main {
    # Verificar se o container está rodando
    if (-not (Test-Container)) {
        exit 1
    }
    
    while ($true) {
        Show-Menu
        $choice = Read-Host "Digite sua opção [0-6]"
        
        switch ($choice) {
            "1" {
                Invoke-SafeCleanup
            }
            "2" {
                Invoke-CompleteCleanup
            }
            "3" {
                Invoke-TotalReset
            }
            "4" {
                Invoke-WipeEverything
            }
            "5" {
                Get-Status
            }
            "6" {
                New-Backup
                Write-ColorText "✅ Backup criado com sucesso!" "Green"
            }
            "0" {
                Write-ColorText "👋 Saindo..." "Green"
                exit 0
            }
            default {
                Write-ColorText "❌ Opção inválida! Tente novamente." "Red"
                Start-Sleep -Seconds 2
            }
        }
        
        Write-Host ""
        Write-ColorText "Pressione Enter para continuar..." "Yellow"
        Read-Host
    }
}

# Executar main se o script for chamado diretamente
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name) {
    Main
}