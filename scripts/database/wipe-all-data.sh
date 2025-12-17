#!/bin/bash

# Script para REMOVER TODOS os dados do banco de dados CRED30
# MANTÉM apenas o admin principal e a estrutura das tabelas

echo "========================================"
echo "  LIMPANDO TODOS OS DADOS - CRED30"
echo "========================================"
echo
echo "ATENÇÃO: Esta operação é IRREVERSÍVEL!"
echo "Apenas o admin principal será mantido."
echo

# Confirmar operação
read -p "Tem certeza que deseja continuar? (S/N): " confirm
if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
    echo
    echo "Operação cancelada pelo usuário."
    exit 0
fi

echo
echo "Iniciando limpeza completa do banco de dados..."
echo

# Executar script de limpeza no Docker
if docker exec -i cred30-postgres psql -U cred30user -d cred30 -f - < scripts/database/wipe-all-data.sql; then
    echo
    echo "========================================"
    echo "      LIMPEZA CONCLUÍDA COM SUCESSO!"
    echo "========================================"
    echo
    echo "Status do banco:"
    echo "- Apenas admin principal mantido"
    echo "- Todas as sequências resetadas"
    echo "- Configurações padrão restauradas"
    echo "- Sistema pronto para novo início"
    echo
else
    echo
    echo "========================================"
    echo "         ERRO NA LIMPEZA!"
    echo "========================================"
    echo
    echo "Código de erro: $?"
    echo "Verifique o log acima para detalhes."
    echo
    exit 1
fi

# Verificação final
echo
echo "=== VERIFICAÇÃO FINAL ==="
echo "Verificando status final do banco..."

# Verificar se apenas o admin existe
admin_count=$(docker exec -i cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM users WHERE email = 'josiassm701@gmail.com';" 2>/dev/null)

if [ "$admin_count" -eq 1 ]; then
    echo "✅ Admin principal mantido com sucesso"
else
    echo "❌ Erro: Admin principal não encontrado"
fi

# Verificar se outras tabelas estão vazias
tables_to_check=("quotas" "loans" "transactions" "withdrawals" "notifications" "referrals" "support_tickets")

for table in "${tables_to_check[@]}"; do
    count=$(docker exec -i cred30-postgres psql -U cred30user -d cred30 -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null)
    if [ "$count" -eq 0 ]; then
        echo "✅ Tabela $table limpa"
    else
        echo "❌ Erro: Tabela $table ainda tem $count registros"
    fi
done

echo
echo "=== RELATÓRIO FINAL ==="
echo "Data/Hora: $(date)"
echo "Operação: LIMPEZA COMPLETA"
echo "Status: CONCLUÍDO"
echo "Próximo passo: Reiniciar aplicação"
echo "========================================"

echo
echo "=== PRÓXIMOS PASSOS RECOMENDADOS ==="
echo "1. Reinicie o backend: bun run dev"
echo "2. Reinicie o frontend (se necessário)"
echo "3. Verifique o login do admin"
echo "4. Teste o sistema com dados limpos"
echo "========================================"

echo
echo "Pressione Enter para continuar..."
read -p ""