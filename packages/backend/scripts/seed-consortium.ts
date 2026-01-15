import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function seedGroup() {
    console.log('🌱 Semeando grupo moto...');
    try {
        await pool.query(`
            INSERT INTO consortium_groups (name, total_value, duration_months, admin_fee_percent, monthly_installment_value, status)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, ['moto', 10000, 60, 10, 183.33, 'OPEN']);
        console.log('✅ Grupo moto semeado com sucesso!');
    } catch (e: any) {
        console.error('❌ Erro ao semear:', e.message);
    } finally {
        await pool.end();
    }
}

seedGroup();
