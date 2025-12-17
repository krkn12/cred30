#!/bin/bash

# =============================================================================
# SCRIPT DE VERIFICAÇÃO PÓS-LIMPEZA - DOCKER
# =============================================================================

set -e  # Exit on error

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Função para exibir banners
show_banner() {
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo
}

# Função para exibir avisos
show_warning() {
    echo -e "${RED}🚨 $1${NC}"
    echo
}

# Função para exibir sucesso
show_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Função para exibir informações
show_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Configurações do Docker
DOCKER_CONTAINER=${DOCKER_CONTAINER:-cred30-postgres}
DOCKER_DB=${DOCKER_DB:-cred30}
DOCKER_USER=${DOCKER_USER:-postgres}

# Função para executar consulta SQL via Docker
exec_sql_query() {
    local query="$1"
    docker exec "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" -c "$query" -t -A 2>/dev/null
}

# Função para executar script SQL via Docker
exec_sql_script() {
    local script_file="$1"
    docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < "$script_file" >/dev/null 2>&1
    return $?
}

# Função principal
main() {
    show_banner "VERIFICAÇÃO PÓS-LIMPEZA - DOCKER"
    
    show_info "Iniciando verificação pós-limpeza..."
    echo
    
    # Verificar se o container está rodando
    show_step "Verificando container Docker..."
    if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
        show_warning "Container Docker '$DOCKER_CONTAINER' não está rodando!"
        echo -e "${RED}Verifique:${NC}"
        echo -e "${RED}• docker ps${NC}"
        echo -e "${RED}• docker start $DOCKER_CONTAINER${NC}"
        exit 1
    fi
    
    show_success "Container Docker encontrado e rodando!"
    echo
    
    # Verificar contagem de registros
    show_step "Verificando contagem de registros em todas as tabelas..."
    
    tables=(
        "users:1"
        "quotas:0"
        "loans:0"
        "loan_installments:0"
        "transactions:0"
        "withdrawals:0"
        "app_settings:6"
    )
    
    all_good=true
    
    for table_info in "${tables[@]}"; do
        table_name=$(echo "$table_info" | cut -d':' -f1)
        expected=$(echo "$table_info" | cut -d':' -f2)
        count=$(exec_sql_query "SELECT COUNT(*) FROM $table_name")
        
        if [ "$count" -eq "$expected" ]; then
            echo -e "  ${GREEN}$table_name:${NC} $count registros (esperado: $expected) ${GREEN}✅ OK${NC}"
        else
            echo -e "  ${RED}$table_name:${NC} $count registros (esperado: $expected) ${RED}❌ ERRO${NC}"
            all_good=false
        fi
    done
    
    echo
    
    # Verificar administrador específico
    show_step "Verificando administrador principal..."
    
    admin_count=$(exec_sql_query "SELECT COUNT(*) FROM users WHERE email = 'josiassm701@gmail.com' AND is_admin = TRUE")
    admin_email=$(exec_sql_query "SELECT email FROM users WHERE is_admin = TRUE LIMIT 1")
    total_users=$(exec_sql_query "SELECT COUNT(*) FROM users")
    
    if [ "$admin_count" -eq 1 ] && [ "$total_users" -eq 1 ]; then
        show_success "Administrador principal preservado corretamente: $admin_email"
    else
        show_warning "Problema com administrador! Total: $total_users, Admin: $admin_count"
        all_good=false
    fi
    
    echo
    
    # Verificar configurações essenciais
    show_step "Verificando configurações essenciais..."
    
    essential_settings=('quota_price' 'loan_interest_rate' 'penalty_rate' 'admin_pix_key' 'min_loan_amount' 'max_loan_amount')
    settings_found=0
    
    for setting in "${essential_settings[@]}"; do
        value=$(exec_sql_query "SELECT value FROM app_settings WHERE key = '$setting'")
        if [ "$value" ]; then
            echo -e "  ${GREEN}✅ $setting = $value${NC}"
            ((settings_found++))
        else
            echo -e "  ${RED}❌ $setting = NÃO ENCONTRADO${NC}"
            all_good=false
        fi
    done
    
    echo
    
    # Verificar integridade referencial
    show_step "Verificando integridade referencial..."
    
    orphan_checks=(
        "quotas:SELECT COUNT(*) FROM quotas q LEFT JOIN users u ON q.user_id = u.id WHERE u.id IS NULL"
        "loans:SELECT COUNT(*) FROM loans l LEFT JOIN users u ON l.user_id = u.id WHERE u.id IS NULL"
        "transactions:SELECT COUNT(*) FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE u.id IS NULL"
        "withdrawals:SELECT COUNT(*) FROM withdrawals w LEFT JOIN users u ON w.user_id = u.id WHERE u.id IS NULL"
    )
    
    for check_info in "${orphan_checks[@]}"; do
        table_name=$(echo "$check_info" | cut -d':' -f1)
        query=$(echo "$check_info" | cut -d':' -f2-)
        orphan_count=$(exec_sql_query "$query")
        
        if [ "$orphan_count" -eq 0 ]; then
            echo -e "  ${GREEN}✅ Sem registros órfãos em $table_name${NC}"
        else
            echo -e "  ${RED}❌ Encontrados $orphan_count registros órfãos em $table_name${NC}"
            all_good=false
        fi
    done
    
    echo
    
    # Resumo final
    show_banner "RESUMO DA VERIFICAÇÃO"
    
    if [ "$all_good" = true ]; then
        echo -e "${GREEN}🎉 SISTEMA EM ESTADO PERFEITO!${NC}"
        echo
        echo -e "${GREEN}✅ Apenas o administrador principal está presente${NC}"
        echo -e "${GREEN}✅ Todas as tabelas de dados estão vazias${NC}"
        echo -e "${GREEN}✅ Configurações essenciais presentes${NC}"
        echo -e "${GREEN}✅ Integridade referencial mantida${NC}"
        echo
        echo -e "${GREEN}🔒 Sistema pronto para operação segura!${NC}"
        echo
        echo -e "${YELLOW}Para testar o acesso:${NC}"
        echo -e "${YELLOW}1. Acesse a interface da aplicação${NC}"
        echo -e "${YELLOW}2. Faça login com: josiassm701@gmail.com${NC}"
        echo -e "${YELLOW}3. Verifique o painel administrativo${NC}"
    else
        echo -e "${RED}❌ SISTEMA EM ESTADO INCONSISTENTE!${NC}"
        echo
        echo -e "${RED}Problemas encontrados:${NC}"
        echo -e "${RED}• Verifique os detalhes acima${NC}"
        echo -e "${RED}• Execute os scripts de correção se necessário${NC}"
        echo -e "${RED}• Considere restaurar do backup${NC}"
    fi
    
    echo
    show_info "Verificação concluída!"
}

# Executar função principal
main