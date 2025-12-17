#!/bin/bash

# Script para iniciar o CRED30 com uma única instância do ngrok
# Este script configura o ambiente com proxy reverso para usar apenas um túnel ngrok

echo "🚀 Iniciando CRED30 com ngrok único..."

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
docker-compose -f docker-compose.single-ngrok.yml down --remove-orphans

# Limpar volumes antigos (opcional)
read -p "Deseja limpar dados antigos? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "🧹 Limpando volumes..."
    docker volume rm cred30_postgres_data cred30_redis_data 2>/dev/null || true
fi

# Iniciar containers
echo "🐳 Iniciando containers com proxy reverso..."
docker-compose -f docker-compose.single-ngrok.yml up -d

# Aguardar serviços iniciarem
echo "⏳ Aguardando serviços iniciarem..."
sleep 30

# Verificar se serviços estão saudáveis
echo "🔍 Verificando saúde dos serviços..."
docker-compose -f docker-compose.single-ngrok.yml ps

# Testar frontend
echo "🧪 Testando frontend..."
if curl -f http://localhost:5173 &> /dev/null; then
    echo "✅ Frontend está funcionando!"
else
    echo "⚠️ Frontend pode não estar totalmente pronto. Aguardando mais..."
    sleep 20
fi

# Testar backend via proxy
echo "🧪 Testando backend via proxy..."
if curl -f http://localhost:5173/api/health &> /dev/null; then
    echo "✅ Backend está funcionando via proxy!"
else
    echo "⚠️ Backend pode não estar totalmente pronto. Aguardando mais..."
    sleep 20
fi

# Popular dados de teste
echo "🌱 Populando dados de teste..."
cd backend
node scripts/populate-test-data.js
cd ..

# Iniciar ngrok para frontend (com proxy para backend)
echo "🌐 Iniciando ngrok para frontend (com proxy reverso)..."
ngrok http 5173 --log=stdout &
NGROK_PID=$!

# Aguardar ngrok inicializar
sleep 10

# Obter URL do ngrok
echo "📋 Obtendo URL do ngrok..."
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)

echo ""
echo "🎉 CRED30 está online com ngrok único!"
echo ""
echo "📱 Acesso Completo (Frontend + Backend via proxy):"
echo "   Local: http://localhost:5173"
echo "   Externo: $NGROK_URL"
echo ""
echo "🔧 Endpoints disponíveis:"
echo "   Frontend: $NGROK_URL"
echo "   API: $NGROK_URL/api"
echo "   Dashboard Admin: $NGROK_URL/admin"
echo ""
echo "👥 Usuários para teste:"
echo "   Admin: admin@cred30.com / admin123"
echo "   Cliente: joao@cred30.com / cliente123"
echo ""
echo "🛠️ Comandos úteis:"
echo "   Ver logs: docker-compose -f docker-compose.single-ngrok.yml logs -f"
echo "   Parar tudo: docker-compose -f docker-compose.single-ngrok.yml down"
echo "   Parar ngrok: kill $NGROK_PID"
echo ""
echo "⚠️  Mantenha este terminal aberto para manter o ngrok ativo."
echo "   Pressione Ctrl+C para parar tudo."
echo ""

# Aguardar interação do usuário
trap 'echo ""; echo "🛑 Parando serviços..."; docker-compose -f docker-compose.single-ngrok.yml down; kill $NGROK_PID 2>/dev/null; echo "✅ Serviços parados."; exit 0' INT

# Manter script rodando
while true; do
    sleep 1
done