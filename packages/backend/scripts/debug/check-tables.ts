import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function listConsortiumTables() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'consortium%';");
        console.log('Tabelas encontradas:', res.rows.map(r => r.table_name));
    } catch (e: any) {
        console.error('Erro:', e.message);
    } finally {
        await pool.end();
    }
}

listConsortiumTables();
