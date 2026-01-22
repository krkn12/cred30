import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        // Ver estrutura de todas as tabelas importantes
        const tables = ['quotas', 'loans', 'promo_videos', 'education_courses', 'education_lessons'];

        for (const table of tables) {
            const cols = await client.query(`
                SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position
            `, [table]);
            console.log(`\n📋 ${table}: ${cols.rows.map(c => c.column_name).join(', ')}`);
        }

    } finally {
        client.release();
        await pool.end();
    }
}
run();
