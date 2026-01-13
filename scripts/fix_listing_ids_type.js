const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function migrate() {
    console.log('--- Migração: Corrigindo tipo de listing_ids para integer[] ---');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Alterar o tipo da coluna convertendo os dados existentes
        await pool.query(`
            ALTER TABLE marketplace_orders 
            ALTER COLUMN listing_ids TYPE integer[] 
            USING listing_ids::text[]::integer[];
        `);
        console.log('✅ Coluna listing_ids alterada para integer[] com sucesso!');

        // Verificar o novo tipo
        const res = await pool.query(`
            SELECT udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_orders' AND column_name = 'listing_ids';
        `);
        console.log('Novo tipo UDT:', res.rows[0]?.udt_name);

    } catch (e) {
        console.error('❌ Erro na migração:', e.message);
        console.log('Tentativa alternativa (se a coluna estiver vazia ou com nulls)...');
        try {
            await pool.query(`
                ALTER TABLE marketplace_orders 
                ALTER COLUMN listing_ids TYPE integer[] 
                USING listing_ids::integer[];
            `);
            console.log('✅ Alteração concluída com cast direto.');
        } catch (e2) {
            console.error('❌ Falha total na migração:', e2.message);
        }
    } finally {
        await pool.end();
    }
}

migrate();
