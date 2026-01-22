/**
 * Script para executar a migration do sistema de crédito PDV
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
    });

    console.log('🚀 Executando migration: 049_pdv_credit_system.sql');

    try {
        const migrationPath = path.join(__dirname, '../src/infrastructure/database/postgresql/migrations/049_pdv_credit_system.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);
        console.log('✅ Migration executada com sucesso!');

        // Verificar colunas criadas
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pdv_charges' 
            AND column_name IN ('loan_id', 'payment_type', 'installments', 'interest_rate', 'total_with_interest', 'guarantee_percentage')
        `);

        console.log('📋 Colunas verificadas:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('❌ Erro na migration:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
