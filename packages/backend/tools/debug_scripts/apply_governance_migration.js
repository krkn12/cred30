// Script para aplicar migration do sistema de governança
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyGovernanceMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('🗳️ Aplicando migration do Sistema de Governança (Cred Democracy)...\n');

        // Ler o arquivo SQL
        const migrationPath = path.join(__dirname, 'src/infrastructure/database/postgresql/migrations/016_create_governance_tables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Executar migration
        await pool.query(sql);

        console.log('✅ Tabela governance_proposals criada!');
        console.log('✅ Tabela governance_votes criada!');
        console.log('✅ Índices e regras de governança aplicados!');

        // Verificar estrutura de uma das tabelas
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'governance_proposals'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Estrutura da tabela governance_proposals:');
        console.log('─'.repeat(50));
        result.rows.forEach(col => {
            console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        console.log('\n🎉 Sistema de Governança pronto para a V2!');

    } catch (error) {
        if (error.code === '42P07') {
            console.log('ℹ️  Tabelas já existem, pulando...');
        } else {
            console.error('❌ Erro ao aplicar migration:', error.message);
        }
    } finally {
        await pool.end();
    }
}

applyGovernanceMigration();
