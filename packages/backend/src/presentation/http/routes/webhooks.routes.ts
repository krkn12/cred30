import { Hono } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { logWebhook, updateWebhookStatus } from '../../../application/services/audit.service';

const webhookRoutes = new Hono();

// Placeholder webhook para compatibilidade
// Com o sistema de PIX manual, os webhooks de gateway não são mais utilizados.
// As confirmações de pagamento são feitas manualmente pelo administrador.
webhookRoutes.post('/payment', async (c) => {
    const pool = getDbPool(c);
    let webhookLogId: number | null = null;

    try {
        const body = await c.req.json();

        // Persistir Webhook para auditoria
        webhookLogId = await logWebhook(pool, 'manual_payment', body);

        console.log('[WEBHOOK] Recebido (modo PIX manual):', JSON.stringify(body));

        // No modo PIX manual, as confirmações são feitas pelo admin
        // Este endpoint existe apenas para compatibilidade e logging
        if (webhookLogId) {
            await updateWebhookStatus(pool, webhookLogId, 'COMPLETED', 'Manual PIX mode - admin confirmation required');
        }

        return c.json({ success: true, message: 'Webhook registrado. Confirmação manual pendente.' });
    } catch (error: any) {
        console.error('[WEBHOOK] Erro:', error);
        if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'FAILED', error.message);
        return c.json({ success: false, error: error.message }, 200);
    }
});

// Webhook de notificação genérico (pode ser usado para integrações futuras)
webhookRoutes.post('/notify', async (c) => {
    try {
        const body = await c.req.json();
        console.log('[WEBHOOK NOTIFY] Recebido:', JSON.stringify(body));
        return c.json({ success: true });
    } catch (error: any) {
        console.error('[WEBHOOK NOTIFY] Erro:', error);
        return c.json({ success: false, error: error.message }, 200);
    }
});

export { webhookRoutes };
