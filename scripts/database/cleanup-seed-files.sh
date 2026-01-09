#!/bin/bash
# Limpar arquivos de seed antigos do backend
# Uso: bash scripts/database/cleanup-seed-files.sh

echo "🧹 Limpando arquivos de seed antigos do backend..."

# Arquivos a remover
FILES=(
  "packages/backend/credit.txt"
  "packages/backend/relatorio.txt"
  "packages/backend/relatorio2.txt"
  "packages/backend/relatorio3.txt"
  "packages/backend/resultado-seed.txt"
  "packages/backend/seed-direct.txt"
  "packages/backend/seed-final.txt"
  "packages/backend/seed-ok.txt"
  "packages/backend/seed-result.txt"
  "packages/backend/seed_output.txt"
  "packages/backend/seed_output_final.txt"
  "packages/backend/seed_output_final_v2.txt"
  "packages/backend/seed_output_final_v3.txt"
  "packages/backend/seed_output_final_v4.txt"
  "packages/backend/seed_output_final_v5.txt"
  "packages/backend/seed_output_final_v6.txt"
  "packages/backend/seed_output_final_v7.txt"
  "packages/backend/seed_output_final_v8.txt"
  "packages/backend/seed_output_final_v9.txt"
  "packages/backend/seed_output_final_v10.txt"
  "packages/backend/tables.txt"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "   🗑️ $file"
  fi
done

echo ""
echo "✅ Arquivos de seed antigos removidos!"
