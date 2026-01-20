import { Pool, PoolClient } from 'pg';

export enum AuditActionType {
    PIX_KEY_UPDATE = 'PIX_KEY_UPDATE',
    CPF_UPDATE = 'CPF_UPDATE',
    SECURITY_PHRASE_UPDATE = 'SECURITY_PHRASE_UPDATE',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    ADMIN_ACTION = 'ADMIN_ACTION',
    WITHDRAWAL_REQUEST = 'WITHDRAWAL_REQUEST'
}

export class AuditService {
    /**
     * Registra uma ação sensível para auditoria
     */
    static async logSensitiveAction(
        pool: Pool | PoolClient,
        userId: string | number,
        actionType: AuditActionType,
        metadata: any,
        ip: string = 'unknown'
    ) {
        try {
            // Por enquanto, logamos no console e podemos inserir em uma tabela 'audit_logs'
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                userId,
                actionType,
                ip,
                metadata
            };

            console.log(`[AUDIT] [${actionType}] User: ${userId} | IP: ${ip} | Data:`, JSON.stringify(metadata));

            // Implementar inserção na tabela de logs para persistência
            await pool.query(
                `INSERT INTO audit_logs (user_id, action_type, metadata, ip_address, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [userId, actionType, JSON.stringify(metadata), ip]
            );

        } catch (error) {
            console.error('[AuditService] Erro ao registrar log de auditoria:', error);
        }
    }
}
