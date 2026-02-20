
import { Hono } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

const nukeMigrationRoute = new Hono();

nukeMigrationRoute.post('/', async (c) => {
    const pool = getDbPool(c);
    try {
        await pool.query(`
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
            
            CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user_id ON terms_acceptance(user_id);
            CREATE INDEX IF NOT EXISTS idx_terms_acceptance_date ON terms_acceptance(accepted_at DESC);
        `);
        return c.json({ success: true, message: 'Tabela terms_acceptance criada com sucesso!' });
    } catch (error: unknown) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

export { nukeMigrationRoute };
