
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const JOSIAS_ID = 1;

    await client.connect();
    console.log('--- RESET DO JOSIAS (COMEÇANDO DO ZERO) ---');

    try {
        // Encontrar todas as tabelas que têm colunas que podem referenciar o Josias
        const colRes = await client.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND column_name IN ('user_id', 'buyer_id', 'seller_id', 'courier_id', 'creator_id', 'reviewer_id')
        `);

        // Para evitar erros de FK, vamos deletar em uma ordem específica ou simplesmente tentar várias vezes
        // (Ou deletar em cascata manual)
        const deletions = colRes.rows.map(row => ({
            table: row.table_name,
            col: row.column_name
        }));

        // Tabelas de dependência primeiro (bids, installments, reviews, etc)
        const priority = ['marketplace_order_items', 'marketplace_reviews', 'marketplace_questions', 'loan_installments', 'consortium_votes', 'consortium_bids'];

        deletions.sort((a, b) => {
            const aIdx = priority.indexOf(a.table);
            const bIdx = priority.indexOf(b.table);
            return (bIdx === -1 ? 0 : bIdx) - (aIdx === -1 ? 0 : aIdx);
        });

        for (const del of deletions) {
            try {
                const res = await client.query(`DELETE FROM ${del.table} WHERE ${del.col} = $1`, [JOSIAS_ID]);
                if (res.rowCount > 0) console.log(`Removidos ${res.rowCount} registros de ${del.table} (${del.col})`);
            } catch (e) {
                // console.log(`Pulo: ${del.table} (${e.message})`);
            }
        }

        // Reset do perfil
        await client.query(
            `UPDATE users 
             SET balance = 0, 
                 score = 1000, 
                 membership_type = 'PRO', 
                 is_verified = true,
                 total_borrowed = 0,
                 total_repaid = 0,
                 seller_total_sales = 0,
                 seller_rating = 5.0,
                 seller_total_reviews = 0,
                 last_deposit_at = NULL,
                 security_lock_until = NULL,
                 xp = 0,
                 level = 1
             WHERE id = $1`,
            [JOSIAS_ID]
        );

        console.log('✅ SUCESSO: Conta do Josias zerada. Status Premium de Desenvolvedor mantido.');

    } catch (err) {
        console.error('Erro crítico no reset:', err.message);
    } finally {
        await client.end();
    }
}
run();
