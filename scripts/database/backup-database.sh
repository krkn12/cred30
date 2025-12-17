#!/bin/bash

# =============================================================================
# SCRIPT DE BACKUP COMPLETO DO BANCO DE DADOS CRED30
# =============================================================================
# Este script cria um backup completo do banco de dados antes da limpeza
# =============================================================================

set -e  # Exit on error

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 INICIANDO BACKUP COMPLETO DO BANCO DE DADOS CRED30${NC}"
echo

# Carrega variáveis de ambiente
if [ -f "packages/backend/.env" ]; then
    source packages/backend/.env
elif [ -f ".env" ]; then
    source .env
fi

# Configurações do banco
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-cred30}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}

# Diretório de backup
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/cred30_backup_${TIMESTAMP}.sql"
BACKUP_COMPRESSED="${BACKUP_FILE}.gz"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Configurações do backup:${NC}"
echo -e "  Host: $DB_HOST"
echo -e "  Porta: $DB_PORT"
echo -e "  Banco: $DB_NAME"
echo -e "  Usuário: $DB_USER"
echo -e "  Arquivo: $BACKUP_COMPRESSED"
echo

# Verificar se o psql está instalado
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql não encontrado! Instale PostgreSQL client.${NC}"
    echo -e "${RED}Ubuntu/Debian: sudo apt-get install postgresql-client${NC}"
    echo -e "${RED}CentOS/RHEL: sudo yum install postgresql${NC}"
    echo -e "${RED}macOS: brew install postgresql${NC}"
    exit 1
fi

# Verificar se o pg_dump está instalado
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}❌ pg_dump não encontrado! Instale PostgreSQL client tools.${NC}"
    exit 1
fi

# Testar conexão com o banco
echo -e "${BLUE}Testando conexão com o banco...${NC}"
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    echo -e "${GREEN}✅ Conexão bem-sucedida!${NC}"
else
    echo -e "${RED}❌ Falha na conexão com o banco de dados!${NC}"
    echo -e "${RED}Verifique as configurações de conexão.${NC}"
    exit 1
fi

# Criar backup completo
echo -e "${BLUE}Criando backup completo...${NC}"
echo -e "${YELLOW}Isso pode levar alguns minutos, dependendo do tamanho do banco...${NC}"

if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose \
    --clean \
    --no-acl \
    --no-owner \
    --format=custom \
    --file="$BACKUP_FILE"; then
    
    echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
    
    # Comprimir o backup
    echo -e "${BLUE}Comprimindo backup...${NC}"
    gzip "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup comprimido com sucesso!${NC}"
        echo -e "${GREEN}📁 Arquivo: $BACKUP_COMPRESSED${NC}"
        
        # Mostrar tamanho do arquivo
        FILE_SIZE=$(du -h "$BACKUP_COMPRESSED" | cut -f1)
        echo -e "${GREEN}📊 Tamanho: $FILE_SIZE${NC}"
    else
        echo -e "${RED}❌ Erro ao comprimir o backup!${NC}"
        exit 1
    fi
    
    # Verificar integridade do backup
    echo -e "${BLUE}Verificando integridade do backup...${NC}"
    
    # Criar banco de teste para verificação
    TEST_DB="${DB_NAME}_test_backup_${TIMESTAMP}"
    
    if PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB" 2>/dev/null; then
        if PGPASSWORD="$DB_PASSWORD" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" --clean --if-exists "$BACKUP_COMPRESSED" &> /dev/null; then
            echo -e "${GREEN}✅ Integridade do backup verificada com sucesso!${NC}"
            PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB"
        else
            echo -e "${RED}❌ Erro na verificação de integridade do backup!${NC}"
            PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB" 2>/dev/null
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️ Não foi possível verificar integridade (sem permissão para criar DB de teste)${NC}"
    fi
    
    # Listar backups anteriores
    echo
    echo -e "${BLUE}📋 Backups anteriores:${NC}"
    ls -la "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 || echo -e "${YELLOW}Nenhum backup anterior encontrado${NC}"
    
    echo
    echo -e "${GREEN}🎉 BACKUP CONCLUÍDO COM SUCESSO!${NC}"
    echo -e "${GREEN}📁 Arquivo de backup: $BACKUP_COMPRESSED${NC}"
    echo -e "${GREEN}📊 Tamanho: $FILE_SIZE${NC}"
    echo
    echo -e "${YELLOW}Para restaurar este backup, use:${NC}"
    echo -e "${BLUE}gunzip -c $BACKUP_COMPRESSED | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME${NC}"
    
else
    echo -e "${RED}❌ Erro ao criar backup!${NC}"
    echo -e "${RED}Verifique:${NC}"
    echo -e "${RED}• Se o banco está acessível${NC}"
    echo -e "${RED}• Se tem permissão de leitura${NC}"
    echo -e "${RED}• Se há espaço em disco suficiente${NC}"
    exit 1
fi

echo
echo -e "${GREEN}✅ Backup completo finalizado com sucesso!${NC}"
echo -e "${YELLOW}⚠️ Mantenha este arquivo em local seguro!${NC}"