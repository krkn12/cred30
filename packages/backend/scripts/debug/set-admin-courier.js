const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('🔄 Atualizando Admin para Entregador...');

    const res = await c.query(`
        UPDATE users 
        SET 
            is_courier = TRUE, 
            courier_status = 'approved', 
            courier_vehicle = 'MOTO', 
            is_verified = TRUE 
        WHERE role = 'ADMIN' 
        RETURNING id, name, email, is_courier, courier_status
    `);

    if (res.rows.length > 0) {
        console.log('✅ Admin configurado com sucesso:');
        res.rows.forEach(r => {
            console.log(`  [${r.id}] ${r.name} (${r.email})`);
            console.log(`  Courier: ${r.is_courier}, Status: ${r.courier_status}, Veículo: MOTO`);
        });
    } else {
        console.log('⚠️ Nenhum usuário com role ADMIN encontrado.');
    }

    await c.end();
}

main().catch(e => console.log('❌ Erro:', e.message));
