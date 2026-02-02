import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';

export class AdminAuditController {
    /**
     * Listar todos os logs de auditoria
     */
    static async getLogs(c: Context) {
        try {
            const user = c.get('user') as UserContext;

            // Verificação Sênior: Apenas admins podem ver logs
            if (!user.isAdmin) {
                return c.json({ success: false, message: 'Acesso negado.' }, 403);
            }

            const pool = getDbPool(c);

            // Buscar logs vinculando com o nome do usuário para facilitar a leitura
            const result = await pool.query(`
                SELECT 
                    al.*, 
                    u.name as user_name,
                    u.email as user_email
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id::integer = u.id
                ORDER BY al.created_at DESC
                LIMIT 100
            `);

            return c.json({
                success: true,
                logs: result.rows
            });
        } catch (error: any) {
            console.error('Erro ao buscar logs de auditoria:', error);
            return c.json({
                success: false,
                message: 'Erro interno ao carregar auditoria.'
            }, 500);
        }
    }

    /**
     * Exportar logs de auditoria para CSV
     */
    static async exportLogs(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            if (!user.isAdmin) return c.json({ success: false, message: 'Acesso negado.' }, 403);

            const pool = getDbPool(c);
            const result = await pool.query(`
                SELECT 
                    al.created_at, u.name as user_name, al.action, al.entity_type, al.entity_id, al.ip_address, al.new_values
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id::integer = u.id
                ORDER BY al.created_at DESC
                LIMIT 1000
            `);

            // Gerar CSV manual (Leve e Rápido)
            let csv = 'Data/Hora,Usuario,Acao,Entidade,ID,IP,Dados\n';
            for (const row of result.rows) {
                const date = new Date(row.created_at).toLocaleString('pt-BR');
                const userName = row.user_name || 'Sistema';
                const action = row.action;
                const entity = row.entity_type || '';
                const id = row.entity_id || '';
                const ip = row.ip_address || '';
                const data = JSON.stringify(row.new_values).replace(/"/g, '""');

                csv += `"${date}","${userName}","${action}","${entity}","${id}","${ip}","${data}"\n`;
            }

            c.header('Content-Type', 'text/csv');
            c.header('Content-Disposition', 'attachment; filename=auditoria_cred30.csv');

            return c.body(csv);
        } catch (error: any) {
            console.error('Erro ao exportar logs:', error);
            return c.json({ success: false, message: 'Erro ao gerar exportação.' }, 500);
        }
    }
}
