#!/bin/bash

# Script para iniciar o CRED30 com ngrok
# Este script configura o ambiente e inicia os serviços com ngrok para acesso externo

echo "🚀 Iniciando CRED30 com ngrok..."

# Verificar se ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não encontrado. Por favor, instale o ngrok:"
    echo "   - Via npm: npm install -g ngrok"
    echo "   - Ou baixe de https://ngrok.com/download"
    exit 1
fi

# Verificar se Docker está rodando
if ! docker info &> /dev/null; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker."
    exit 1
fi

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker-compose -f docker-compose.ngrok.yml down --remove-orphans

# Limpar volumes antigos (opcional)
read -p "Deseja limpar dados antigos? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "🧹 Limpando volumes..."
    docker volume rm cred30_postgres_data cred30_redis_data 2>/dev/null || true
fi

# Iniciar containers
echo "🐳 Iniciando containers..."
docker-compose -f docker-compose.ngrok.yml up -d

# Aguardar serviços iniciarem
echo "⏳ Aguardando serviços iniciarem..."
sleep 30

# Verificar se serviços estão saudáveis
echo "🔍 Verificando saúde dos serviços..."
docker-compose -f docker-compose.ngrok.yml ps

# Testar backend
echo "🧪 Testando backend..."
if curl -f http://localhost:3001/api/health &> /dev/null; then
    echo "✅ Backend está funcionando!"
else
    echo "⚠️ Backend pode não estar totalmente pronto. Aguardando mais..."
    sleep 20
fi

# Testar frontend
echo "🧪 Testando frontend..."
if curl -f http://localhost:5173 &> /dev/null; then
    echo "✅ Frontend está funcionando!"
else
    echo "⚠️ Frontend pode não estar totalmente pronto. Aguardando mais..."
    sleep 20
fi

# Iniciar ngrok para frontend
echo "🌐 Iniciando ngrok para frontend (porta 5173)..."
ngrok http 5173 --log=stdout &
NGROK_FRONTEND_PID=$!

# Iniciar ngrok para backend
echo "🔌 Iniciando ngrok para backend (porta 3001)..."
ngrok http 3001 --log=stdout &
NGROK_BACKEND_PID=$!

# Aguardar ngrok inicializar
sleep 10

# Obter URLs do ngrok
echo "📋 Obtendo URLs do ngrok..."
FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)
BACKEND_URL=$(curl -s http://localhost:4041/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)

echo ""
echo "🎉 CRED30 está online com ngrok!"
echo ""
echo "📱 Frontend (Interface Web):"
echo "   Local: http://localhost:5173"
echo "   Externo: $FRONTEND_URL"
echo ""
echo "🔌 Backend (API):"
echo "   Local: http://localhost:3001"
echo "   Externo: $BACKEND_URL"
echo ""
echo "👥 Usuários para teste:"
echo "   Admin: admin@cred30.com / admin123"
echo "   Cliente: cliente@cred30.com / cliente123"
echo ""
echo "📊 Dashboard Admin: $FRONTEND_URL/admin"
echo "🏠 Dashboard Cliente: $FRONTEND_URL"
echo ""
echo "🛠️ Comandos úteis:"
echo "   Ver logs: docker-compose -f docker-compose.ngrok.yml logs -f"
echo "   Parar tudo: docker-compose -f docker-compose.ngrok.yml down"
echo "   Parar ngrok: kill $NGROK_FRONTEND_PID $NGROK_BACKEND_PID"
echo ""
echo "⚠️  Mantenha este terminal aberto para manter o ngrok ativo."
echo "   Pressione Ctrl+C para parar tudo."
echo ""

# Aguardar interação do usuário
trap 'echo ""; echo "🛑 Parando serviços..."; docker-compose -f docker-compose.ngrok.yml down; kill $NGROK_FRONTEND_PID $NGROK_BACKEND_PID 2>/dev/null; echo "✅ Serviços parados."; exit 0' INT

# Manter script rodando
while true; do
    sleep 1
done