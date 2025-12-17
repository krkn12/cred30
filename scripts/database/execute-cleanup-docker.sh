#!/bin/bash

# =============================================================================
# SCRIPT DE EXECUÇÃO COMPLETA DE LIMPEZA DE DADOS - DOCKER
# =============================================================================
# Este script orquestra todo o processo de limpeza de dados do sistema CRED30
# Incluindo backup, limpeza e verificação usando Docker
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
    echo -e "${RED}🚨 $1 🚨${NC}"
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

# Função para exibir etapas
show_step() {
    echo -e "${YELLOW}🔸 $1${NC}"
}

# Configurações do Docker
DOCKER_CONTAINER=${DOCKER_CONTAINER:-cred30-postgres}
DOCKER_DB=${DOCKER_DB:-cred30}
DOCKER_USER=${DOCKER_USER:-postgres}

# Carregar variáveis de ambiente se existirem
if [ -f ".env" ]; then
    source .env
fi

# Função para verificar dependências
check_dependencies() {
    show_step "Verificando dependências..."
    
    if ! command -v docker &> /dev/null; then
        show_warning "Docker não encontrado! Instale Docker."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        show_warning "Docker Compose não encontrado! Instale Docker Compose."
        exit 1
    fi
    
    show_success "Dependências verificadas com sucesso!"
    echo
}

# Função para testar conexão com container
test_container_connection() {
    show_step "Testando conexão com container Docker..."
    
    if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
        show_warning "Container Docker '$DOCKER_CONTAINER' não está rodando!"
        echo -e "${RED}Verifique:${NC}"
        echo -e "${RED}• docker ps${NC}"
        echo -e "${RED}• docker start $DOCKER_CONTAINER${NC}"
        exit 1
    fi
    
    # Testar conexão com o banco
    if docker exec "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" -c "SELECT 1;" &> /dev/null; then
        show_success "Conexão com container bem-sucedida!"
    else
        show_warning "Falha na conexão com o banco de dados!"
        echo -e "${RED}Verifique as configurações do container.${NC}"
        exit 1
    fi
    echo
}

# Função para criar backup
create_backup() {
    show_step "Criando backup completo do banco..."
    
    ./scripts/database/backup-database-docker.sh
    
    if [ $? -eq 0 ]; then
        show_success "Backup criado com sucesso!"
    else
        show_warning "Falha ao criar backup!"
        exit 1
    fi
    echo
}

# Função para identificar tabelas
identify_tables() {
    show_step "Identificando tabelas e dados..."
    
    echo -e "${YELLOW}Análise das tabelas do banco:${NC}"
    docker exec "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" -c "
        SELECT 
            table_name,
            CASE 
                WHEN table_name IN ('users', 'quotas', 'loans', 'loan_installments', 'transactions', 'withdrawals') 
                THEN 'DATA_TABLE'
                WHEN table_name = 'app_settings' 
                THEN 'CONFIG_TABLE'
                ELSE 'OTHER'
            END as table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    "
    
    if [ $? -eq 0 ]; then
        show_success "Análise concluída!"
    else
        show_warning "Falha na análise das tabelas!"
        exit 1
    fi
    echo
}

# Função para executar limpeza
execute_cleanup() {
    local cleanup_type="$1"
    
    show_step "Executando limpeza de dados ($cleanup_type)..."
    
    case $cleanup_type in
        "selective")
            show_info "Executando limpeza seletiva (preservando administrador)..."
            docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < scripts/database/wipe-user-data.sql
            ;;
        "admin-only")
            show_info "Executando limpeza completa EXCETO administrador..."
            docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < scripts/database/wipe-all-except-admin.sql
            ;;
        "complete")
            show_info "Executando limpeza completa (100% dos dados)..."
            docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < scripts/database/wipe-all-data.sql
            ;;
        *)
            show_warning "Tipo de limpeza inválido: $cleanup_type"
            exit 1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        show_success "Limpeza executada com sucesso!"
    else
        show_warning "Falha na execução da limpeza!"
        exit 1
    fi
    echo
}

# Função para verificar limpeza
verify_cleanup() {
    show_step "Verificando resultados da limpeza..."
    
    ./scripts/database/verify-cleanup-docker.sh
    
    if [ $? -eq 0 ]; then
        show_success "Verificação concluída!"
    else
        show_warning "Falha na verificação da limpeza!"
        exit 1
    fi
    echo
}

# Função para exibir recomendações finais
show_recommendations() {
    local cleanup_type="$1"
    
    show_banner "RECOMENDAÇÕES FINAIS"
    
    echo -e "${GREEN}🎉 Processo de limpeza concluído com sucesso!${NC}"
    echo
    
    case $cleanup_type in
        "selective")
            echo -e "${BLUE}Para o sistema funcionar corretamente:${NC}"
            echo -e "• O administrador (josiassm701@gmail.com) pode acessar o sistema normalmente"
            echo -e "• Novos usuários podem ser cadastrados"
            echo -e "• Todas as funcionalidades estão disponíveis"
            echo
            echo -e "${YELLOW}Para testar o acesso:${NC}"
            echo -e "1. Acesse a interface da aplicação"
            echo -e "2. Faça login com: josiassm701@gmail.com"
            echo -e "3. Verifique o painel administrativo"
            ;;
        "admin-only")
            echo -e "${BLUE}Para o sistema funcionar corretamente:${NC}"
            echo -e "• APENAS o administrador (josiassm701@gmail.com) existe no sistema"
            echo -e "• 100% de todos os dados foram removidos"
            echo -e "• Configurações básicas foram recriadas"
            echo -e "• Sistema pronto para operação limpa"
            echo
            echo -e "${YELLOW}Para testar o acesso:${NC}"
            echo -e "1. Acesse a interface da aplicação"
            echo -e "2. Faça login com: josiassm701@gmail.com"
            echo -e "3. Verifique o painel administrativo vazio"
            ;;
        "complete")
            echo -e "${BLUE}Para o sistema funcionar corretamente:${NC}"
            echo -e "• Execute o script de inicialização do banco: scripts/database/init-db-fixed.sql"
            echo -e "• Crie o primeiro usuário administrador"
            echo -e "• Configure as configurações essenciais do sistema"
            echo
            echo -e "${YELLOW}Para inicializar o sistema:${NC}"
            echo -e "1. Execute: docker exec -i $DOCKER_CONTAINER psql -U $DOCKER_USER -d $DOCKER_DB < scripts/database/init-db-fixed.sql"
            echo -e "2. Acesse a aplicação e crie o primeiro administrador"
            ;;
    esac
    
    echo
    echo -e "${RED}⚠️ AVISOS IMPORTANTES:${NC}"
    echo -e "• Mantenha o backup em local seguro"
    echo -e "• Verifique se a aplicação está funcionando corretamente"
    echo -e "• Monitore os logs do sistema nos primeiros dias"
    echo -e "• Documente esta operação para auditoria futura"
    echo
}

# Função principal
main() {
    local cleanup_type=""
    
    # Verificar argumentos
    if [ $# -eq 0 ]; then
        show_banner "SCRIPT DE LIMPEZA DE DADOS - CRED30 (DOCKER)"
        echo -e "${YELLOW}Uso: $0 [TIPO_DE_LIMPEZA]${NC}"
        echo
        echo -e "${BLUE}Tipos de limpeza disponíveis:${NC}"
        echo -e "  selective  - Limpa dados de usuários, preservando o administrador principal"
        echo -e "  admin-only - APAGA TUDO exceto o administrador principal"
        echo -e "  complete   - Limpa 100% de todos os dados do banco"
        echo
        echo -e "${RED}⚠️ AVISO: Esta operação é IRREVERSÍVEL!${NC}"
        echo -e "${RED}⚠️ Sempre faça backup antes de prosseguir!${NC}"
        exit 1
    fi
    
    cleanup_type="$1"
    
    if [ "$cleanup_type" != "selective" ] && [ "$cleanup_type" != "admin-only" ] && [ "$cleanup_type" != "complete" ]; then
        show_warning "Tipo de limpeza inválido! Use 'selective', 'admin-only' ou 'complete'."
        exit 1
    fi
    
    # Exibir aviso principal
    show_banner "AVISO EXTREMO - OPERAÇÃO IRREVERSÍVEL (DOCKER)"
    show_warning "ESTA OPERAÇÃO APAGARÁ DADOS PERMANENTEMENTE!"
    show_warning "NÃO HÁ COMO VOLTAR ATRÁS DEPOIS DE EXECUTAR!"
    echo
    
    if [ "$cleanup_type" = "selective" ]; then
        echo -e "${YELLOW}Dados que serão APAGADOS:${NC}"
        echo -e "${YELLOW}• Todos os usuários exceto o administrador principal${NC}"
        echo -e "${YELLOW}• Todas as transações financeiras${NC}"
        echo -e "${YELLOW}• Todas as cotas de investimento${NC}"
        echo -e "${YELLOW}• Todos os empréstimos e parcelas${NC}"
        echo -e "${YELLOW}• Todos os saques${NC}"
        echo
        echo -e "${GREEN}Dados que serão PRESERVADOS:${NC}"
        echo -e "${GREEN}• Administrador principal (josiassm701@gmail.com)${NC}"
        echo -e "${GREEN}• Configurações do sistema${NC}"
    elif [ "$cleanup_type" = "admin-only" ]; then
        echo -e "${RED}🔥 DADOS que serão APAGADOS (100%):${NC}"
        echo -e "${RED}• TODOS os usuários EXCETO o administrador principal${NC}"
        echo -e "${RED}• TODAS as transações financeiras${NC}"
        echo -e "${RED}• TODAS as cotas de investimento${NC}"
        echo -e "${RED}• TODOS os empréstimos e parcelas${NC}"
        echo -e "${RED}• TODOS os saques${NC}"
        echo -e "${RED}• TODAS as configurações do sistema (serão recriadas)${NC}"
        echo
        echo -e "${GREEN}🔒 ÚNICO dado que será PRESERVADO:${NC}"
        echo -e "${GREEN}• APENAS o administrador principal (josiassm701@gmail.com)${NC}"
    else
        echo -e "${RED}Dados que serão APAGADOS:${NC}"
        echo -e "${RED}• TODOS os usuários (inclusive administradores)${NC}"
        echo -e "${RED}• TODAS as transações financeiras${NC}"
        echo -e "${RED}• TODAS as cotas de investimento${NC}"
        echo -e "${RED}• TODOS os empréstimos e parcelas${NC}"
        echo -e "${RED}• TODOS os saques${NC}"
        echo -e "${RED}• TODAS as configurações do sistema${NC}"
    fi
    
    echo
    echo -e "${YELLOW}Digite 'CONFIRMAR' para prosseguir com a limpeza ($cleanup_type):${NC}"
    echo -e "${YELLOW}Ou pressione Ctrl+C para cancelar${NC}"
    echo
    
    read -p "Confirmação: " confirmation
    
    if [ "$confirmation" != "CONFIRMAR" ]; then
        echo -e "${RED}❌ Confirmação incorreta. Operação cancelada.${NC}"
        exit 1
    fi
    
    echo
    show_success "Confirmação recebida! Iniciando processo de limpeza..."
    echo
    
    # Executar fluxo completo
    check_dependencies
    test_container_connection
    create_backup
    identify_tables
    execute_cleanup "$cleanup_type"
    verify_cleanup
    show_recommendations "$cleanup_type"
    
    show_banner "OPERAÇÃO CONCLUÍDA COM SUCESSO! (DOCKER)"
    show_success "Limpeza de dados ($cleanup_type) concluída!"
    echo -e "${GREEN}🔒 O sistema está pronto para operação!${NC}"
}

# Executar função principal
main "$@"