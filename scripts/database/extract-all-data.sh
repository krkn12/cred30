#!/bin/bash

# Script para extrair TODOS os dados do banco de dados CRED30
# Gera um backup completo em formato SQL

echo "========================================"
echo "  EXTRAINDO TODOS OS DADOS - CRED30"
echo "========================================"
echo

# Criar diretório de backup
BACKUP_DIR="database/backup"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/cred30_complete_backup_$TIMESTAMP.sql"

echo
echo "Diretório de backup: $BACKUP_DIR"
echo "Arquivo de backup: $BACKUP_FILE"
echo

# Executar extração de dados no Docker
echo
echo "Iniciando extração de dados do PostgreSQL..."
echo

if docker exec -i cred30-postgres psql -U cred30user -d cred30 -f - < scripts/database/extract-all-data.sql > "$BACKUP_FILE" 2>&1; then
    echo
    echo "========================================"
    echo "  EXTRAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "========================================"
    echo
    echo "Arquivo salvo em: $BACKUP_FILE"
    echo "Tamanho do arquivo: $(du -h "$BACKUP_FILE" | cut -f1)"
    echo
    echo "Total de tabelas extraídas: 25"
    echo
else
    echo
    echo "========================================"
    echo "      ERRO NA EXTRAÇÃO!"
    echo "========================================"
    echo
    echo "Código de erro: $?"
    echo "Verifique o log acima para detalhes."
    echo
    exit 1
fi

# Mostrar resumo do arquivo gerado
echo
echo "=== RESUMO DO BACKUP GERADO ==="
echo "Data/Hora: $TIMESTAMP"
echo "Arquivo: $BACKUP_FILE"
echo

# Contar linhas no arquivo (aproximado)
if [ -f "$BACKUP_FILE" ]; then
    LINE_COUNT=$(wc -l < "$BACKUP_FILE")
    echo "Linhas aproximadas: $LINE_COUNT"
fi

echo
echo "=== PRÓXIMOS PASSOS RECOMENDADOS ==="
echo "1. Verifique o arquivo de backup"
echo "2. Teste a restauração em ambiente de teste"
echo "3. Mantenha o backup em local seguro"
echo "4. Documente a data do backup para rastreamento"
echo
echo "========================================"

# Pausar para usuário visualizar
read -p "Pressione Enter para continuar..."