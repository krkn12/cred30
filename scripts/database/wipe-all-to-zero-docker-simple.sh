#!/bin/bash

# =============================================================================
# SCRIPT DE LIMPEZA COMPLETA - DOCKER SIMPLIFICADO
# =============================================================================
# ⚠️ AVISO EXTREMO: ESTE SCRIPT APAGARÁ 100% DE TODOS OS DADOS
# INCLUSIVE CONFIGURAÇÕES - DEIXARÁ O BANCO COMPLETAMENTE VAZIO
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

show_banner "LIMPEZA COMPLETA - DEIXAR TUDO ZERADO - DOCKER"

show_warning "ESTA OPERAÇÃO APAGARÁ 100% DE TODOS OS DADOS!"
show_warning "INCLUSIVE TODAS AS CONFIGURAÇÕES DO SISTEMA!"
show_warning "O BANCO FICARÁ COMPLETAMENTE VAZIO!"
show_warning "NÃO HÁ COMO VOLTAR ATRÁS DEPOIS DE EXECUTAR!"

echo
echo -e "${RED}🔥 TUDO SERÁ APAGADO:${NC}"
echo -e "${RED}• TODOS os usuários (inclusive administradores)${NC}"
echo -e "${RED}• TODAS as transações financeiras${NC}"
echo -e "${RED}• TODAS as cotas de investimento${NC}"
echo -e "${RED}• TODOS os empréstimos e parcelas${NC}"
echo -e "${RED}• TODOS os saques${NC}"
echo -e "${RED}• TODAS as configurações do sistema${NC}"
echo -e "${RED}• TODAS as sequências serão resetadas${NC}"
echo
echo -e "${GREEN}🎯 RESULTADO FINAL:${NC}"
echo -e "${GREEN}• BANCO 100% LIMPO E ZERADO${NC}"
echo -e "${GREEN}• SISTEMA PRECISARÁ SER REINICIALIZADO${NC}"
echo

echo -e "${YELLOW}Digite 'APAGAR_TUDO' para prosseguir com a limpeza completa:${NC}"
echo -e "${YELLOW}Ou pressione Ctrl+C para cancelar${NC}"
echo

read -p "Confirmação: " confirmation

if [ "$confirmation" != "APAGAR_TUDO" ]; then
    echo -e "${RED}❌ Confirmação incorreta. Operação cancelada.${NC}"
    exit 1
fi

echo
show_success "Confirmação recebida! Iniciando apagamento TOTAL..."
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

# Criar backup antes de apagar tudo
show_step "Criando backup de segurança antes de apagar tudo..."
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/cred30_backup_before_wipe_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

if docker exec "$DOCKER_CONTAINER" pg_dump -U "$DOCKER_USER" -d "$DOCKER_DB" --verbose --clean --no-acl --no-owner > "$BACKUP_FILE"; then
    show_success "Backup de segurança criado com sucesso!"
    
    # Comprimir backup
    gzip "$BACKUP_FILE"
    show_success "Backup comprimido com sucesso!"
    show_info "Arquivo: $BACKUP_FILE.gz"
    
    # Mostrar tamanho
    FILE_SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)
    show_info "Tamanho: $FILE_SIZE"
else
    show_warning "Falha ao criar backup!"
    exit 1
fi

echo

# Executar limpeza completa usando Docker
show_step "Executando limpeza COMPLETA - deixando tudo ZERADO..."

if docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < scripts/database/wipe-everything-to-zero.sql; then
    show_success "Limpeza COMPLETA executada com sucesso!"
else
    show_warning "Falha na execução da limpeza completa!"
    exit 1
fi

echo

# Verificar que tudo foi apagado
show_step "Verificando que tudo foi ZERADO..."

# Verificar se todas as tabelas estão vazias
tables=("users" "quotas" "loans" "loan_installments" "transactions" "withdrawals" "app_settings")
all_empty=true

for table in "${tables[@]}"; do
    count=$(docker exec "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null)
    
    if [ "$count" -eq "0" ]; then
        echo -e "${GREEN}  ✅ Tabela $table: VAZIA${NC}"
    else
        echo -e "${RED}  ❌ Tabela $table: ainda tem $count registros${NC}"
        all_empty=false
    fi
done

echo

if [ "$all_empty" = true ]; then
    show_success "Verificação concluída! Todas as tabelas estão vazias!"
else
    show_warning "Falha na verificação! Algumas tabelas ainda têm dados!"
    exit 1
fi

echo
show_banner "OPERAÇÃO CONCLUÍDA COM SUCESSO!"
show_success "BANCO DE DADOS 100% ZERADO!"
echo -e "${GREEN}🎯 RESULTADO FINAL ALCANÇADO!${NC}"
echo -e "${GREEN}🔥 BANCO COMPLETAMENTE VAZIO!${NC}"
echo -e "${GREEN}🔄 SISTEMA PRECISA SER REINICIALIZADO!${NC}"
echo
echo
echo -e "${BLUE}🔄 PRÓXIMOS PASSOS OBRIGATÓRIOS:${NC}"
echo -e "${YELLOW}1. Execute o script de inicialização:${NC}"
echo -e "${GREEN}   docker exec -i $DOCKER_CONTAINER psql -U $DOCKER_USER -d $DOCKER_DB < scripts/database/init-db-fixed.sql${NC}"
echo -e "${YELLOW}2. Crie o primeiro usuário administrador${NC}"
echo -e "${YELLOW}3. Configure as configurações essenciais${NC}"
echo -e "${YELLOW}4. Teste o sistema do zero${NC}"
echo
echo
echo -e "${RED}⚠️ AVISO IMPORTANTE:${NC}"
echo -e "${RED}• O backup de segurança foi salvo em ./backups/${NC}"
echo -e "${RED}• Nenhuma funcionalidade estará disponível até a reconfiguração${NC}"
echo -e "${RED}• Execute o script de inicialização para recriar o sistema${NC}"
echo
echo
echo -e "${GREEN}🎉 BANCO ZERADO COM SUCESSO!${NC}"