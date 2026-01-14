
const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render') ? { rejectUnauthorized: false } : false
});

async function createConsortiumTables() {
    const client = await pool.connect();
    try {
        console.log('🏗️ Criando tabelas do Sistema de Consórcio...');

        await client.query('BEGIN');

        // 1. consortium_groups
        await client.query(`
      CREATE TABLE IF NOT EXISTS consortium_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        total_value DECIMAL(10, 2) NOT NULL, -- Valor da carta
        duration_months INTEGER NOT NULL,
        admin_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
        monthly_installment_value DECIMAL(10, 2) NOT NULL,
        start_date DATE,
        status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, ACTIVE, COMPLETED, CANCELLED
        current_assembly_number INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('✅ Tabela consortium_groups criada.');

        // 2. consortium_members (Cotas)
        await client.query(`
      CREATE TABLE IF NOT EXISTS consortium_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES consortium_groups(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        quota_number INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, CONTEMPLATED, DEFAULTING, CANCELLED
        contemplated_at TIMESTAMP,
        contemplation_type VARCHAR(50), -- BID, DRAW, NONE
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(group_id, quota_number)
      );
    `);
        console.log('✅ Tabela consortium_members criada.');

        // 3. consortium_assemblies (Assembleias)
        await client.query(`
      CREATE TABLE IF NOT EXISTS consortium_assemblies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES consortium_groups(id) ON DELETE CASCADE,
        assembly_number INTEGER NOT NULL,
        month_year VARCHAR(7) NOT NULL, -- "MM/YYYY"
        status VARCHAR(50) DEFAULT 'SCHEDULED', -- SCHEDULED, OPEN_FOR_BIDS, VOTING, FINISHED
        total_pool_collected DECIMAL(12, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(group_id, assembly_number)
      );
    `);
        console.log('✅ Tabela consortium_assemblies criada.');

        // 4. consortium_bids (Lances)
        await client.query(`
      CREATE TABLE IF NOT EXISTS consortium_bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assembly_id UUID NOT NULL REFERENCES consortium_assemblies(id) ON DELETE CASCADE,
        member_id UUID NOT NULL REFERENCES consortium_members(id),
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, WINNER, LOST, DISQUALIFIED
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('✅ Tabela consortium_bids criada.');

        // 5. consortium_votes (Votação da Assembleia)
        await client.query(`
      CREATE TABLE IF NOT EXISTS consortium_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assembly_id UUID NOT NULL REFERENCES consortium_assemblies(id) ON DELETE CASCADE,
        voter_id UUID NOT NULL REFERENCES users(id),
        target_bid_id UUID NOT NULL REFERENCES consortium_bids(id),
        vote BOOLEAN NOT NULL, -- TRUE = Sim, FALSE = Não
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(assembly_id, voter_id, target_bid_id)
      );
    `);
        console.log('✅ Tabela consortium_votes criada.');

        await client.query('COMMIT');
        console.log('🚀 Todas as tabelas do Consórcio foram criadas com sucesso!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao criar tabelas:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

createConsortiumTables();
