
import { Pool, PoolClient } from 'pg';

interface AuditLogEntry {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Registra uma ação no log de auditoria
 */
export const logAudit = async (pool: Pool | PoolClient, entry: AuditLogEntry) => {
    try {
        await pool.query(
            `INSERT INTO audit_logs 
            (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                entry.userId,
                entry.action,
                entry.entityType,
                entry.entityId,
                entry.oldValues ? JSON.stringify(entry.oldValues) : null,
                entry.newValues ? JSON.stringify(entry.newValues) : null,
                entry.ipAddress,
                entry.userAgent
            ]
        );
    } catch (error) {
        console.error('Erro ao salvar log de auditoria:', error);
        // Não jogamos erro para não quebrar a transação principal por causa de um log
    }
};

/**
 * Registra um log de webhook recebido
 */
export const logWebhook = async (pool: Pool | PoolClient, provider: string, payload: any) => {
    try {
        const result = await pool.query(
            'INSERT INTO webhook_logs (provider, payload, status) VALUES ($1, $2, $3) RETURNING id',
            [provider, JSON.stringify(payload), 'PENDING']
        );
        return result.rows[0].id;
    } catch (error) {
        console.error('Erro ao salvar log de webhook:', error);
        return null;
    }
};

/**
 * Atualiza status do processamento do webhook
 */
export const updateWebhookStatus = async (pool: Pool | PoolClient, id: number, status: 'COMPLETED' | 'FAILED', errorMessage?: string) => {
    try {
        await pool.query(
            'UPDATE webhook_logs SET status = $1, error_message = $2, processed_at = NOW() WHERE id = $3',
            [status, errorMessage, id]
        );
    } catch (error) {
        console.error('Erro ao atualizar status do webhook:', error);
    }
};
