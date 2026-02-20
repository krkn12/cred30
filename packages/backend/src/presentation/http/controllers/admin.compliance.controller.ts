import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

export class AdminComplianceController {
    /**
     * Lista todos os aceites de termos (Audit Trail para fiscais)
     */
    static async listTermsAcceptances(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await pool.query(`
                SELECT ta.*, u.name as user_name, u.email as user_email
                FROM terms_acceptance ta
                JOIN users u ON ta.user_id = u.id
                ORDER BY ta.accepted_at DESC
                LIMIT 100
            `);
            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            console.error('Erro ao listar aceites de termos:', error);
            return c.json({ success: false, message: 'Erro ao buscar registros de compliance' }, 500);
        }
    }

    /**
     * Gera um resumo de saúde jurídica (Blindagem)
     */
    static async getComplianceStats(c: Context) {
        try {
            const pool = getDbPool(c);

            // Total de usuários com termos aceitos na versão atual
            const currentTermsVersion = '2.0';
            const stats = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM terms_acceptance WHERE terms_version = $1) as users_with_current_terms
                FROM dual -- Simplificação, pode variar conforme DB
            `, [currentTermsVersion]).catch(async () => {
                // Fallback para PostgreSQL sem dual
                return pool.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM users) as total_users,
                        (SELECT COUNT(*) FROM terms_acceptance WHERE terms_version = $1) as users_with_current_terms
                `, [currentTermsVersion]);
            });

            return c.json({
                success: true,
                data: {
                    termsVersion: currentTermsVersion,
                    ...stats.rows[0]
                }
            });
        } catch (error: unknown) {
            return c.json({ success: false, message: 'Erro ao gerar estatísticas de compliance' }, 500);
        }
    }

    /**
     * Lista usuários pendentes de KYC
     */
    static async listPendingKyc(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await pool.query(`
                SELECT id, name, email, cpf, phone, kyc_status, kyc_document_path, created_at, kyc_notes
                FROM users 
                WHERE kyc_status = 'PENDING'
                ORDER BY created_at ASC
            `);
            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            console.error('Erro ao listar pendências KYC:', error);
            return c.json({ success: false, message: 'Erro ao buscar pendências' }, 500);
        }
    }
}
