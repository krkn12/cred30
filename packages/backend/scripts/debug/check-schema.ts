import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const res = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('users', 'transactions') AND column_name = 'id';");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e: any) {
        console.error('Erro:', e.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
