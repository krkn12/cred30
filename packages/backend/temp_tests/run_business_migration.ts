
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const sqlPath = path.join(__dirname, '../src/infrastructure/database/postgresql/migrations/052_business_docs.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executando migração Business Docs...');
        await pool.query(sql);
        console.log('Campos Business adicionados com sucesso!');
    } catch (err) {
        console.error('Erro na migração:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
