const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function initSystem() {
    console.log("🛠️  INICIALIZANDO SISTEMA (Modo Seguro - V2)...");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Configurar System Config
            console.log('Verificando System Config...');
            const configCheck = await client.query('SELECT id FROM system_config LIMIT 1');

            if (configCheck.rows.length === 0) {
                console.log('Inserindo config (DEFAULT VALUES)...');
                const insertRes = await client.query('INSERT INTO system_config DEFAULT VALUES RETURNING id');
                const id = insertRes.rows[0].id;
                console.log(`Config inserida com ID: ${id}`);

                console.log('Atualizando valores padrão...');
                await client.query(`
                    UPDATE system_config SET
                        system_balance = 0,
                        profit_pool = 0,
                        total_owner_profit = 0,
                        investment_reserve = 0,
                        total_tax_reserve = 0,
                        total_operational_reserve = 0,
                        quota_price = 50.00,
                        loan_interest_rate = 0.20,
                        penalty_rate = 0.05
                    WHERE id = $1
                `, [id]);
                console.log('✅ System Config inicializado e atualizado.');
            } else {
                console.log('ℹ️ System Config já existente (mantido).');
            }

            // 2. Tabela de Custos (Opcional)
            try {
                const costsTableExists = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'system_costs'
                    );
                `);

                if (costsTableExists.rows[0].exists) {
                    await client.query('TRUNCATE TABLE system_costs CASCADE');
                    await client.query(`
                        INSERT INTO system_costs (description, amount, is_recurring, created_at)
                        VALUES 
                        ('MEI (Mensal)', 87.00, true, NOW()),
                        ('Servidor Render', 50.00, true, NOW())
                    `);
                    console.log('✅ Custos iniciais redefinidos.');
                }
            } catch (err) {
                console.warn("⚠️ Aviso ao configurar custos:", err.message);
            }

            // 3. Admin (Verificar apenas)
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail) {
                const adminCheck = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
                if (adminCheck.rows.length > 0) {
                    console.log(`ℹ️ Usuário Admin (${adminEmail}) já está no banco.`);
                } else {
                    console.log(`ℹ️ Usuário Admin (${adminEmail}) NÃO existe no banco. Aguardando Login Google para criação.`);
                }
            }

            await client.query('COMMIT');
            console.log("\n🚀 SISTEMA PRONTO PARA USO (0 KM)!");

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", error);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

initSystem();
