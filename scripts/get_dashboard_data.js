// Script para buscar dados do dashboard diretamente do localStorage
// COMO USAR:
// 1. Abre o painel Admin no navegador (já logado)
// 2. Abre o Console do DevTools (F12 → Console)
// 3. Cola este código e dá Enter

(async function () {
    console.log('🔍 Buscando dados do dashboard...\n');

    // Pegar token do localStorage
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    if (!token) {
        console.error('❌ Token não encontrado no localStorage!');
        console.log('Certifique-se de estar logado.');
        return;
    }

    console.log('✅ Token encontrado:', token.substring(0, 20) + '...\n');

    try {
        // Fazer requisição ao dashboard
        const response = await fetch('http://localhost:3001/api/admin/dashboard?refresh=true', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!data.success) {
            console.error('❌ Erro na API:', data.message);
            return;
        }

        // Extrair dados importantes
        const liquidity = data.data?.systemConfig?.real_liquidity;
        const cached = data.cached;

        console.log('========================================');
        console.log('📊 DADOS DO DASHBOARD');
        console.log('========================================');
        console.log('💰 Liquidez Real:', liquidity);
        console.log('📦 Veio do cache?', cached ? 'SIM ❌' : 'NÃO ✅');
        console.log('========================================\n');

        console.log('🔍 Objeto completo:');
        console.log(data);

        // Retornar para poder inspecionar
        return data;

    } catch (error) {
        console.error('❌ Erro ao buscar dashboard:', error);
    }
})();
