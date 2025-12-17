#!/bin/bash

# =============================================================================
# TESTE NGROK DETECTION - Script para testar detecção de URLs Ngrok
# =============================================================================

echo "🔍 Testando detecção do Ngrok..."
echo

# Verifica se curl está disponível
if ! command -v curl >/dev/null 2>&1; then
    echo "❌ curl não está instalado"
    exit 1
fi

echo "✅ curl está disponível"
echo

# Testa conexão com API do Ngrok
echo "🌐 Testando conexão com API do Ngrok..."
NGROK_API_URL="http://127.0.0.1:4040/api/tunnels"

if curl -s --connect-timeout 3 "$NGROK_API_URL" >/dev/null 2>&1; then
    echo "✅ API do Ngrok acessível em $NGROK_API_URL"
else
    echo "❌ Não foi possível conectar à API do Ngrok"
    echo "   Verifique se o Ngrok está rodando: ngrok http 3001"
    exit 1
fi

echo

# Obtém resposta da API
echo "📡 Obtendo informações dos túneis..."
response=$(curl -s "$NGROK_API_URL")

if [ -z "$response" ]; then
    echo "❌ Resposta vazia da API do Ngrok"
    exit 1
fi

echo "Resposta bruta:"
echo "$response" | head -20
echo

# Tenta extrair URL com jq
if command -v jq >/dev/null 2>&1; then
    echo "🔧 Extraindo URL com jq..."
    https_url=$(echo "$response" | jq -r '.tunnels[] | select(.proto=="https") | .public_url' | head -n1)
else
    echo "🔧 Extraindo URL com grep/sed..."
    https_url=$(echo "$response" | grep -o '"public_url":"https://[^"]*' | sed 's/"public_url":"https:\/\///' | head -n1)
fi

if [ -n "$https_url" ]; then
    echo "✅ URL HTTPS detectada: $https_url"
    
    # Testa se a URL responde
    echo
    echo "🌐 Testando se a URL responde..."
    if curl -s --connect-timeout 5 "$https_url" >/dev/null 2>&1; then
        echo "✅ URL está respondendo"
    else
        echo "⚠️  URL não está respondendo (pode ser normal)"
    fi
    
    echo
    echo "🎯 URL para usar no frontend: ${https_url}/api"
    echo "🎯 URL para usar no backend: $https_url"
    
else
    echo "❌ Não foi possível extrair URL HTTPS"
    echo "   Verifique se há túneis HTTPS ativos no Ngrok"
fi

echo
echo "🏁 Teste concluído!"