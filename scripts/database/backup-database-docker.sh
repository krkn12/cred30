#!/bin/bash

# =============================================================================
# SCRIPT DE BACKUP COMPLETO DO BANCO DE DADOS - DOCKER
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

show_banner "INICIANDO BACKUP COMPLETO DO BANCO DE DADOS CRED30 - DOCKER"

echo -e "${YELLOW}Configurações do backup:${NC}"
echo -e "  Container: $DOCKER_CONTAINER"
echo -e "  Banco: $DOCKER_DB"
echo -e "  Usuário: $DOCKER_USER"
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

# Criar diretório de backup
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/cred30_backup_$TIMESTAMP.sql"
BACKUP_COMPRESSED="$BACKUP_FILE.gz"

echo -e "${YELLOW}Arquivo de backup: $BACKUP_COMPRESSED${NC}"
echo

# Criar backup
show_step "Criando backup completo..."
echo -e "${YELLOW}Isso pode levar alguns minutos, dependendo do tamanho do banco...${NC}"

if docker exec "$DOCKER_CONTAINER" pg_dump -U "$DOCKER_USER" -d "$DOCKER_DB" --verbose --clean --no-acl --no-owner > "$BACKUP_FILE"; then
    show_success "Backup criado com sucesso!"
    
    # Comprimir o backup
    show_step "Comprimindo backup..."
    gzip "$BACKUP_FILE"
    
    if [ -f "$BACKUP_COMPRESSED" ]; then
        show_success "Backup comprimido com sucesso!"
        show_info "Arquivo: $BACKUP_COMPRESSED"
        
        # Mostrar tamanho do arquivo
        FILE_SIZE=$(du -h "$BACKUP_COMPRESSED" | cut -f1)
        show_info "Tamanho: $FILE_SIZE"
        
        # Listar backups anteriores
        echo
        echo -e "${BLUE}Backups anteriores:${NC}"
        ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || echo -e "${YELLOW}Nenhum backup anterior encontrado${NC}"
        
        echo
        echo -e "${YELLOW}Para restaurar este backup, use:${NC}"
        echo -e "${GREEN}gunzip -c $BACKUP_COMPRESSED | docker exec -i $DOCKER_CONTAINER psql -U $DOCKER_USER -d $DOCKER_DB${NC}"
        
    else
        show_warning "Erro ao comprimir o backup!"
        exit 1
    fi
else
    show_warning "Falha ao criar backup!"
    echo -e "${RED}Verifique:${NC}"
    echo -e "${RED}• Se o container está acessível${NC}"
    echo -e "${RED}• Se tem permissão de leitura${NC}"
    echo -e "${RED}• Se há espaço em disco suficiente${NC}"
    exit 1
fi

echo
show_success "Backup completo finalizado com sucesso!"
show_info "Mantenha este arquivo em local seguro!"