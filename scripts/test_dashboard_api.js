
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/dashboard?refresh=true',
    method: 'GET',
    headers: {
        // Mimic admin auth if needed, but since it's local we might bypass or use a mock
        'Authorization': 'Bearer local-dev-token'
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('--- DASHBOARD API RESPONSE ---');
            console.log('Real Liquidity:', json.data?.systemConfig?.real_liquidity);
            console.log('Reserves:', {
                tax: json.data?.systemConfig?.total_tax_reserve,
                oper: json.data?.systemConfig?.total_operational_reserve,
                profit: json.data?.systemConfig?.total_owner_profit,
                mutual: json.data?.systemConfig?.mutual_reserve,
                total: json.data?.systemConfig?.total_reserves
            });
        } catch (e) {
            console.log('Error parsing JSON:', e.message);
            console.log('Raw Data:', data);
        }
    });
});

req.on('error', (e) => console.error('Request Error:', e.message));
req.end();
