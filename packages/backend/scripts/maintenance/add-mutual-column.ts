import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function addColumn() {
    try {
        await pool.query("ALTER TABLE system_config ADD COLUMN IF NOT EXISTS mutual_reserve DECIMAL(15,2) DEFAULT 0;");
        console.log('✅ Coluna mutual_reserve adicionada com sucesso!');
    } catch (e: any) {
        console.error('❌ Erro:', e.message);
    } finally {
        await pool.end();
    }
}

addColumn();
