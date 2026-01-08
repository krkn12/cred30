import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { logWebhook, updateWebhookStatus } from '../../../application/services/audit.service';

export class WebhooksController {
    /**
     * Webhook de pagamento (PIX Manual)
     */
    static async handlePayment(c: Context) {
        const pool = getDbPool(c);
        let webhookLogId: number | null = null;

        try {
            const body = await c.req.json();

            // Persistir Webhook para auditoria
            webhookLogId = await logWebhook(pool, 'manual_payment', body);

            console.log('[WEBHOOK] Recebido (modo PIX manual):', JSON.stringify(body));

            if (webhookLogId) {
                await updateWebhookStatus(pool, webhookLogId, 'COMPLETED', 'Manual PIX mode - admin confirmation required');
            }

            return c.json({ success: true, message: 'Webhook registrado. Confirmação manual pendente.' });
        } catch (error: any) {
            console.error('[WEBHOOK] Erro:', error);
            if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'FAILED', error.message);
            return c.json({ success: false, error: error.message }, 200);
        }
    }

    /**
     * Webhook de notificação genérica
     */
    static async handleNotify(c: Context) {
        try {
            const body = await c.req.json();
            console.log('[WEBHOOK NOTIFY] Recebido:', JSON.stringify(body));
            return c.json({ success: true });
        } catch (error: any) {
            console.error('[WEBHOOK NOTIFY] Erro:', error);
            return c.json({ success: false, error: error.message }, 200);
        }
    }
}
