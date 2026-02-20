
import { Hono } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

const retroTermsRoute = new Hono();

retroTermsRoute.post('/', async (c) => {
    const pool = getDbPool(c);
    try {
        // Insere termos para quem já aceitou (tem accepted_terms_at) mas não tem registro na tabela terms_acceptance
        const result = await pool.query(`
            INSERT INTO terms_acceptance (user_id, terms_version, privacy_version, ip_address, user_agent, accepted_at)
            SELECT id, '2.0', '1.0', '127.0.0.1', 'Migration Script', accepted_terms_at
            FROM users
            WHERE accepted_terms_at IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM terms_acceptance WHERE user_id = users.id AND terms_version = '2.0'
            )
        `);

        return c.json({ success: true, message: `Blindagem retroativa aplicada! ${result.rowCount} registros criados.` });
    } catch (error: unknown) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

export { retroTermsRoute };
