import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function checkSystemConfig() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'system_config';");
        console.log(JSON.stringify(res.rows.map(r => r.column_name), null, 2));
    } catch (e: any) {
        console.error('Erro:', e.message);
    } finally {
        await pool.end();
    }
}

checkSystemConfig();
