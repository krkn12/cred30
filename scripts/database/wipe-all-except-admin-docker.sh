#!/bin/bash

# =============================================================================
# SCRIPT DE LIMPEZA COMPLETA EXCETO ADMINISTRADOR - DOCKER
# =============================================================================
# ⚠️ AVISO EXTREMO: ESTE SCRIPT APAGARÁ 100% DE TODOS OS DADOS
# EXCETO O ADMINISTRADOR PRINCIPAL (josiassm701@gmail.com)
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

show_banner "LIMPEZA COMPLETA EXCETO ADMINISTRADOR - DOCKER"

show_warning "ESTA OPERAÇÃO APAGARÁ 100% DOS DADOS EXCETO O ADMIN!"
show_warning "NÃO HÁ COMO VOLTAR ATRÁS DEPOIS DE EXECUTAR!"

echo
echo -e "${RED}Dados que serão APAGADOS (100%):${NC}"
echo -e "${RED}• TODOS os usuários EXCETO o administrador principal${NC}"
echo -e "${RED}• TODAS as transações financeiras${NC}"
echo -e "${RED}• TODAS as cotas de investimento${NC}"
echo -e "${RED}• TODOS os empréstimos e parcelas${NC}"
echo -e "${RED}• TODOS os saques${NC}"
echo -e "${RED}• TODAS as configurações do sistema (serão recriadas)${NC}"
echo
echo -e "${GREEN}ÚNICO dado que será PRESERVADO:${NC}"
echo -e "${GREEN}• APENAS o administrador principal (josiassm701@gmail.com)${NC}"
echo

echo -e "${YELLOW}Digite 'CONFIRMAR' para prosseguir com a limpeza:${NC}"
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

# Verificar se o container está rodando
show_step "Verificando container Docker..."
if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
    show_warning "Container Docker '$DOCKER_CONTAINER' não está rodando!"
    echo -e "${RED}Verifique:${NC}"
    echo -e "${RED}• Se o container está rodando: docker ps${NC}"
    echo -e "${RED}• Se o nome está correto: docker ps -a${NC}"
    echo -e "${RED}• Inicie o container: docker start $DOCKER_CONTAINER${NC}"
    exit 1
fi

show_success "Container Docker encontrado e rodando!"

# Criar backup usando Docker
show_step "Criando backup completo do banco..."
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/cred30_backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

if docker exec "$DOCKER_CONTAINER" pg_dump -U "$DOCKER_USER" -d "$DOCKER_DB" --verbose --clean --no-acl --no-owner > "$BACKUP_FILE"; then
    show_success "Backup criado com sucesso!"
    
    # Comprimir backup
    gzip "$BACKUP_FILE"
    show_success "Backup compactado com sucesso!"
    show_info "Arquivo: $BACKUP_FILE.gz"
    
    # Mostrar tamanho
    FILE_SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)
    show_info "Tamanho: $FILE_SIZE"
else
    show_warning "Falha ao criar backup!"
    exit 1
fi

echo

# Executar limpeza usando Docker
show_step "Executando limpeza completa exceto administrador..."

if docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < scripts/database/wipe-all-except-admin.sql; then
    show_success "Limpeza executada com sucesso!"
else
    show_warning "Falha na execução da limpeza!"
    exit 1
fi

echo

# Verificar resultados usando Docker
show_step "Verificando resultados da limpeza..."

if docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < scripts/database/verify-cleanup.sql; then
    show_success "Verificação concluída!"
else
    show_warning "Falha na verificação da limpeza!"
    exit 1
fi

echo
show_banner "OPERAÇÃO CONCLUÍDA COM SUCESSO!"
show_success "Limpeza completa exceto administrador concluída!"
echo -e "${GREEN}🔒 O sistema está pronto para operação com apenas o administrador!${NC}"
echo
echo -e "${YELLOW}Para testar o acesso:${NC}"
echo -e "${YELLOW}1. Acesse a interface da aplicação${NC}"
echo -e "${YELLOW}2. Faça login com: josiassm701@gmail.com${NC}"
echo -e "${YELLOW}3. Verifique o painel administrativo vazio${NC}"
echo
echo -e "${GREEN}🎉 Operação concluída com sucesso usando Docker!${NC}"