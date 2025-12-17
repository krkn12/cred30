#!/bin/bash

# =============================================================================
# LIMPAR CAIXA OPERACIONAL - Script para limpar dados do banco
# =============================================================================
# Descrição: Limpa dados sensíveis do banco de dados Caixa Operacional
# Autor: Senior DevOps Automation Specialist
# Versão: 1.0.0
# =============================================================================

set -e  # Exit on error

# =============================================================================
# CONFIGURAÇÕES
# =============================================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# FUNÇÕES
# =============================================================================

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verifica se o comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# VERIFICAÇÃO DE PRÉ-REQUISITOS
# =============================================================================

check_prerequisites() {
    print_header "VERIFICANDO PRÉ-REQUISITOS"
    
    # Verifica se tem psql ou node com scripts de DB
    if ! command_exists psql && ! [ -f "package.json" ]; then
        print_error "Nenhum cliente de banco de dados encontrado (psql ou node)"
        print_info "Instale PostgreSQL ou verifique se tem acesso ao banco"
        exit 1
    fi
    
    print_success "Pré-requisitos verificados"
}

# =============================================================================
# FUNÇÕES DE LIMPEZA
# =============================================================================

# Limpa usando psql (PostgreSQL direto)
clean_with_psql() {
    local db_host="${DB_HOST:-localhost}"
    local db_port="${DB_PORT:-5432}"
    local db_name="${DB_NAME:-caixa_operacional}"
    local db_user="${DB_USER:-postgres}"
    
    print_header "LIMPANDO COM POSTGRESQL DIRETO"
    
    # Tabelas principais do Caixa Operacional (ajuste conforme necessário)
    local tables=(
        "transacoes"
        "movimentacoes_caixa"
        "lancamentos"
        "operacoes_financeiras"
        "saldo_diario"
        "resumo_caixa"
        "auditoria_caixa"
    )
    
    for table in "${tables[@]}"; do
        print_info "Limpando tabela: $table"
        
        # TRUNCATE é mais rápido que DELETE e reseta auto increment
        if psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "TRUNCATE TABLE $table RESTART IDENTITY CASCADE;" 2>/dev/null; then
            print_success "Tabela $table limpa"
        else
            print_warning "Tabela $table não encontrada ou sem permissão"
        fi
    done
    
    print_success "Limpeza com PostgreSQL concluída"
}

# Limpa usando scripts Node.js
clean_with_node() {
    print_header "LIMPANDO COM SCRIPTS NODE.JS"
    
    # Procura por scripts de limpeza no projeto
    local clean_scripts=(
        "scripts/database/clean-database.js"
        "scripts/database/reset-database.js"
        "scripts/database/clear-expired-tokens.js"
        "scripts/database/reset-db.js"
    )
    
    for script in "${clean_scripts[@]}"; do
        if [ -f "$script" ]; then
            print_info "Executando script: $script"
            
            if node "$script" 2>/dev/null; then
                print_success "Script $script executado com sucesso"
            else
                print_warning "Script $script falhou ou precisa de configuração"
            fi
        fi
    done
    
    print_success "Limpeza com scripts Node.js concluída"
}

# Limpa usando comandos SQL diretos
clean_with_sql() {
    print_header "LIMPANDO COM SQL DIRETO"
    
    # SQL de limpeza genérico
    local sql_commands="
        -- Limpa tabelas de transações
        DELETE FROM transacoes WHERE data < CURRENT_DATE - INTERVAL '30 days';
        
        -- Limpa tabelas de movimentações
        DELETE FROM movimentacoes_caixa WHERE data < CURRENT_DATE - INTERVAL '30 days';
        
        -- Limpa logs antigos
        DELETE FROM auditoria_caixa WHERE data_hora < CURRENT_DATE - INTERVAL '90 days';
        
        -- Reseta saldos
        UPDATE saldo_diario SET valor = 0 WHERE data = CURRENT_DATE;
        
        -- Limpa sessões expiradas
        DELETE FROM sessoes_ativas WHERE expiracao < NOW();
    "
    
    # Salva em arquivo temporário
    echo "$sql_commands" > /tmp/clean_caixa.sql
    
    print_info "Arquivo SQL criado: /tmp/clean_caixa.sql"
    print_info "Execute manualmente: psql -h localhost -U postgres -d caixa_operacional -f /tmp/clean_caixa.sql"
    
    print_success "SQL gerado com sucesso"
}

# =============================================================================
# MENU INTERATIVO
# =============================================================================

show_menu() {
    echo
    echo -e "${BLUE}Escolha o método de limpeza:${NC}"
    echo "1) Limpar com PostgreSQL (psql)"
    echo "2) Limpar com Scripts Node.js"
    echo "3) Gerar SQL para execução manual"
    echo "4) Limpeza COMPLETA (todos os métodos)"
    echo "5) Sair"
    echo
    read -p "Opção: " -n 1 -r
    echo
}

# =============================================================================
# FUNÇÃO PRINCIPAL
# =============================================================================

main() {
    print_header "LIMPEZA CAIXA OPERACIONAL"
    
    echo -e "${YELLOW}⚠️  ATENÇÃO: Esta operação irá LIMPAR DADOS do banco!${NC}"
    echo -e "${YELLOW}⚠️  Certifique-se de ter BACKUP antes de continuar!${NC}"
    echo
    
    read -p "Tem certeza que deseja continuar? (s/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_info "Operação cancelada pelo usuário"
        exit 0
    fi
    
    # Carrega variáveis de ambiente se existir
    if [ -f ".env" ]; then
        source .env
        print_info "Variáveis de ambiente carregadas de .env"
    elif [ -f "packages/backend/.env" ]; then
        source packages/backend/.env
        print_info "Variáveis de ambiente carregadas de packages/backend/.env"
    fi
    
    check_prerequisites
    
    # Menu interativo
    while true; do
        show_menu
        
        case $REPLY in
            1)
                clean_with_psql
                break
                ;;
            2)
                clean_with_node
                break
                ;;
            3)
                clean_with_sql
                break
                ;;
            4)
                print_info "Executando limpeza COMPLETA..."
                clean_with_psql
                clean_with_node
                print_success "Limpeza completa finalizada!"
                break
                ;;
            5)
                print_info "Saindo..."
                exit 0
                ;;
            *)
                print_error "Opção inválida: $REPLY"
                ;;
        esac
        
        echo
        read -p "Deseja continuar? (s/N): " -n 1 -r
        echo
        
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            break
        fi
    done
    
    print_success "Operação concluída!"
}

# =============================================================================
# EXECUÇÃO
# =============================================================================

# Verifica parâmetros de linha de comando
if [ $# -gt 0 ]; then
    case $1 in
        --psql)
            clean_with_psql
            ;;
        --node)
            clean_with_node
            ;;
        --sql)
            clean_with_sql
            ;;
        --complete)
            clean_with_psql
            clean_with_node
            ;;
        --help|-h)
            echo "Uso: $0 [opção]"
            echo "Opções:"
            echo "  --psql      Limpar usando PostgreSQL direto"
            echo "  --node       Limpar usando scripts Node.js"
            echo "  --sql        Gerar SQL para execução manual"
            echo "  --complete   Limpeza completa (todos os métodos)"
            echo "  --help       Mostra esta ajuda"
            exit 0
            ;;
        *)
            print_error "Opção inválida: $1"
            echo "Use --help para ver as opções"
            exit 1
            ;;
    esac
else
    # Modo interativo
    main
fi