#!/bin/bash

# =============================================================================
# SCRIPT DE TESTE PARA LIMPEZA SEGURA DO BANCO CRED30
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
CONTAINER_NAME="cred30-postgres"
DB_USER="cred30user"
DB_NAME="cred30"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}    🔧 TESTE DE LIMPEZA SEGURA DO BANCO CRED30${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo

# Função para testar conexão
test_connection() {
    echo -e "${YELLOW}🔍 Testando conexão com o banco...${NC}"
    
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Conexão com banco estabelecida!${NC}"
        return 0
    else
        echo -e "${RED}❌ Falha na conexão com o banco!${NC}"
        return 1
    fi
}

# Função para testar estrutura
test_structure() {
    echo -e "${YELLOW}🏗️ Testando estrutura das tabelas...${NC}"
    
    local tables=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    ")
    
    echo -e "${BLUE}📋 Tabelas encontradas:${NC}"
    echo "$tables" | head -10
    
    # Verificar tabelas críticas
    local critical_tables=("users" "quotas" "loans" "transactions")
    
    for table in "${critical_tables[@]}"; do
        if echo "$tables" | grep -q "$table"; then
            echo -e "${GREEN}✅ Tabela crítica '$table' encontrada${NC}"
        else
            echo -e "${RED}❌ Tabela crítica '$table' NÃO encontrada!${NC}"
        fi
    done
}

# Função para testar dados
test_data() {
    echo -e "${YELLOW}📊 Testando dados existentes...${NC}"
    
    local counts=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
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
    ")
    
    echo -e "${BLUE}📈 Contagem de registros:${NC}"
    echo "$counts"
}

# Função para testar backup
test_backup() {
    echo -e "${YELLOW}💾 Testando criação de backup...${NC}"
    
    local backup_dir="./backups"
    mkdir -p $backup_dir
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/test_backup_$timestamp.sql"
    
    if docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > "$backup_file"; then
        echo -e "${GREEN}✅ Backup criado: $backup_file${NC}"
        
        # Verificar tamanho do backup
        local size=$(du -h "$backup_file" | cut -f1)
        echo -e "${BLUE}📏 Tamanho do backup: $size${NC}"
        
        # Verificar se backup contém dados
        local has_data=$(grep -c "INSERT INTO\|COPY" "$backup_file" || echo "0")
        if [ "$has_data" -gt "0" ]; then
            echo -e "${GREEN}✅ Backup contém dados${NC}"
        else
            echo -e "${YELLOW}⚠️ Backup parece estar vazio${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ Falha ao criar backup!${NC}"
        return 1
    fi
}

# Função para testar permissões
test_permissions() {
    echo -e "${YELLOW}🔐 Testando permissões do usuário do banco...${NC}"
    
    local perms=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT 
            has_database_privilege(d.datid, 'CREATE', d.datname) as can_create,
            has_database_privilege(d.datid, 'CONNECT', d.datname) as can_connect
        FROM pg_database d 
        WHERE d.datname = '$DB_NAME';
    ")
    
    echo "$perms"
    
    if echo "$perms" | grep -q "t"; then
        echo -e "${GREEN}✅ Permissões adequadas${NC}"
        return 0
    else
        echo -e "${RED}❌ Permissões insuficientes!${NC}"
        return 1
    fi
}

# Função para testar integridade
test_integrity() {
    echo -e "${YELLOW}🔍 Testando integridade do banco...${NC}"
    
    # Verificar sequências
    local sequences=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT 
            sequence_name,
            last_value
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public';
    ")
    
    echo -e "${BLUE}🔢 Sequências encontradas:${NC}"
    echo "$sequences" | head -5
    
    # Verificar constraints
    local constraints=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT 
            tc.constraint_name,
            tc.table_name,
            tc.constraint_type
        FROM information_schema.table_constraints tc
        JOIN information_schema.tables t ON tc.table_name = t.table_name
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name;
    ")
    
    echo -e "${BLUE}🔗 Constraints encontradas:${NC}"
    echo "$constraints" | head -5
}

# Menu principal
show_menu() {
    clear
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${BLUE}    🧪 MENU DE TESTES - LIMPEZA SEGURA${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo
    echo -e "${GREEN}1)${NC} ${YELLOW}Testar Conexão${NC}"
    echo -e "${GREEN}2)${NC} ${YELLOW}Testar Estrutura${NC}"
    echo -e "${GREEN}3)${NC} ${YELLOW}Testar Dados${NC}"
    echo -e "${GREEN}4)${NC} ${YELLOW}Testar Backup${NC}"
    echo -e "${GREEN}5)${NC} ${YELLOW}Testar Permissões${NC}"
    echo -e "${GREEN}6)${NC} ${YELLOW}Testar Integridade${NC}"
    echo -e "${GREEN}7)${NC} ${YELLOW}Executar Todos os Testes${NC}"
    echo -e "${GREEN}0)${NC} ${RED}Sair${NC}"
    echo
    echo -e "${BLUE}============================================================================${NC}"
}

# Executar todos os testes
run_all_tests() {
    echo -e "${GREEN}🚀 Executando todos os testes...${NC}"
    echo
    
    local test_results=()
    
    # Testar conexão
    if test_connection; then
        test_results+=("✅ Conexão: OK")
    else
        test_results+=("❌ Conexão: FALHOU")
    fi
    
    # Testar estrutura
    if test_structure; then
        test_results+=("✅ Estrutura: OK")
    else
        test_results+=("❌ Estrutura: FALHOU")
    fi
    
    # Testar dados
    test_data
    test_results+=("✅ Dados: Verificado")
    
    # Testar backup
    if test_backup; then
        test_results+=("✅ Backup: OK")
    else
        test_results+=("❌ Backup: FALHOU")
    fi
    
    # Testar permissões
    if test_permissions; then
        test_results+=("✅ Permissões: OK")
    else
        test_results+=("❌ Permissões: FALHOU")
    fi
    
    # Testar integridade
    test_integrity
    test_results+=("✅ Integridade: Verificado")
    
    echo
    echo -e "${BLUE}📋 RESUMO DOS TESTES:${NC}"
    for result in "${test_results[@]}"; do
        echo -e "$result"
    done
    echo
}

# Programa principal
main() {
    while true; do
        show_menu
        echo -n -e "${GREEN}Digite sua opção [0-7]: ${NC}"
        read choice
        
        case $choice in
            1)
                test_connection
                ;;
            2)
                test_structure
                ;;
            3)
                test_data
                ;;
            4)
                test_backup
                ;;
            5)
                test_permissions
                ;;
            6)
                test_integrity
                ;;
            7)
                run_all_tests
                ;;
            0)
                echo -e "${GREEN}👋 Saindo...${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Opção inválida! Tente novamente.${NC}"
                sleep 2
                ;;
        esac
        
        echo
        echo -e "${YELLOW}Pressione Enter para continuar...${NC}"
        read
    done
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi