import { Pool, PoolClient } from 'pg';

export enum AuditActionType {
    PIX_KEY_UPDATE = 'PIX_KEY_UPDATE',
    CPF_UPDATE = 'CPF_UPDATE',
    SECURITY_PHRASE_UPDATE = 'SECURITY_PHRASE_UPDATE',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    ADMIN_ACTION = 'ADMIN_ACTION',
    WITHDRAWAL_REQUEST = 'WITHDRAWAL_REQUEST',
    BUY_QUOTA = 'BUY_QUOTA',
    SELL_QUOTA = 'SELL_QUOTA',
    LOAN_REQUEST = 'LOAN_REQUEST',
    LOAN_PAYMENT = 'LOAN_PAYMENT'
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

            // Implementação Ativa: Persistência Fintech Imutável
            const { entityType, entityId, oldValues, newValues, ...otherMetadata } = metadata || {};

            await pool.query(
                `INSERT INTO audit_logs (
                    user_id, 
                    action, 
                    entity_type, 
                    entity_id, 
                    old_values, 
                    new_values, 
                    ip_address, 
                    created_at
                )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [
                    userId,
                    actionType,
                    entityType || null,
                    entityId || null,
                    oldValues || (Object.keys(otherMetadata).length > 0 ? otherMetadata : null), // Fallback para salvar outros dados se não houver oldValues
                    newValues || JSON.stringify(metadata), // Garante que tudo seja salvo em new_values se não estiver estruturado
                    ip
                ]
            );

        } catch (error) {
            console.error('[AuditService] Erro crítico ao persistir log de auditoria:', error);
            // Em sistema financeiro, falha de auditoria é grave, mas não deve derrubar a transação principal se não for bloqueante.
            // Manteremos log de erro no console por enquanto.
        }
    }
}

/**
 * Atalho para registrar logs de auditoria técnica (legado/compatibilidade)
 */
export async function logAudit(pool: Pool | PoolClient, data: any) {
    const userId = data.userId || 'system';
    const action = (data.action || 'UNKNOWN_ACTION') as AuditActionType;
    delete data.userId;
    delete data.action;

    return AuditService.logSensitiveAction(pool, userId, action, data);
}
