
require('dotenv').config({ path: 'packages/backend/.env' });
const { Client } = require('pg');

const client = new Client(process.env.DATABASE_URL);

async function repair() {
    await client.connect();
    console.log('🔧 Reparando tabela `terms_acceptance`...');

    try {
        // Tentar dropar se existir (talvez quebrada)
        await client.query('DROP TABLE IF EXISTS terms_acceptance CASCADE');

        // Recriar com tipos corretos
        await client.query(`
            CREATE TABLE IF NOT EXISTS terms_acceptance (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                terms_version VARCHAR(20) NOT NULL DEFAULT '2.0',
                privacy_version VARCHAR(20) NOT NULL DEFAULT '1.0',
                ip_address VARCHAR(45),
                user_agent TEXT,
                accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                accepted_age_requirement BOOLEAN NOT NULL DEFAULT true,
                accepted_risk_disclosure BOOLEAN NOT NULL DEFAULT true,
                accepted_terms BOOLEAN NOT NULL DEFAULT true,
                accepted_privacy BOOLEAN NOT NULL DEFAULT true,
                UNIQUE(user_id, terms_version, privacy_version)
            );
        `);

        console.log('✅ Tabela recriada com sucesso!');

        // Recriar índices
        await client.query('CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user_id ON terms_acceptance(user_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_terms_acceptance_date ON terms_acceptance(accepted_at DESC);');

        console.log('✅ Índices recriados!');

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        await client.end();
    }
}

repair();
