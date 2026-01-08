require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fixDatabase() {
    try {
        console.log('Aplicando correções no banco de dados (Usando credenciais do .env)...');

        // 1. Verificar tipo do ID de users para compatibilidade
        const resId = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'");
        const idType = resId.rows[0]?.data_type;
        console.log('Tipo de ID da tabela users:', idType);

        const refType = idType === 'integer' ? 'INTEGER' : 'UUID';

        // 2. Adicionar colunas de Market/Logística se faltarem
        await pool.query(`
            ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
            ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;
            ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'NONE';
            ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10);
            ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_rating INT CHECK (courier_rating >= 1 AND courier_rating <= 5);
            ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
        `);

        // Tentar adicionar courier_id com tratamento de erro caso tipo seja incompatível se já existir errado
        try {
            await pool.query(`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_id ${refType} REFERENCES users(id)`);
        } catch (e) {
            console.log('Aviso ao adicionar courier_id (pode já existir ou ter conflito):', e.message);
        }

        console.log('✅ Tabelas de Marketplace/Logística verificadas.');

        // 3. Adicionar Colunas para a NOVA LÓGICA DE BÔNUS (E score)
        // Precisamos: two_factor_enabled (boolean), membership_type (varchar)
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) DEFAULT 'FREE';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 100; -- Score inicial
        `);

        console.log('✅ Colunas de Usuário (Score, 2FA, VIP) verificadas.');

        // 4. Garantir tabela system_config
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                system_balance DECIMAL(15, 2) DEFAULT 0,
                total_tax_reserve DECIMAL(15, 2) DEFAULT 0,
                total_operational_reserve DECIMAL(15, 2) DEFAULT 0,
                total_owner_profit DECIMAL(15, 2) DEFAULT 0,
                profit_pool DECIMAL(15, 2) DEFAULT 0
            );
            
            -- Inserir linha inicial se não existir
            INSERT INTO system_config (id, system_balance) 
            SELECT 1, 0 
            WHERE NOT EXISTS (SELECT 1 FROM system_config);
        `);

        console.log('✅ Configuração do sistema verificada.');

        console.log('🚀 Banco de dados atualizado e sincronizado com o Backend!');

    } catch (err) {
        console.error('❌ Erro crítico ao atualizar banco:', err);
    } finally {
        pool.end();
    }
}

fixDatabase();
