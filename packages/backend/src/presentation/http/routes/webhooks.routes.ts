import { Hono } from 'hono';
import { PoolClient } from 'pg';
import crypto from 'crypto';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { checkPaymentStatus } from '../../../infrastructure/gateways/mercadopago.service';
import { executeInTransaction, processTransactionApproval } from '../../../domain/services/transaction.service';
import { logWebhook, updateWebhookStatus } from '../../../application/services/audit.service';

const webhookRoutes = new Hono();

webhookRoutes.post('/mercadopago', async (c) => {
    const pool = getDbPool(c);
    let webhookLogId: number | null = null;

    try {
        const body = await c.req.json();

        // 1. Persistir Webhook IMEDIATAMENTE (Segurança contra queda de servidor)
        webhookLogId = await logWebhook(pool, 'mercadopago', body);

        const xSignature = c.req.header('x-signature');
        const xRequestId = c.req.header('x-request-id');
        const secret = process.env.MP_WEBHOOK_SECRET;

        console.log(`[WEBHOOK MP] Recebido (ID Log: ${webhookLogId}):`, JSON.stringify(body));

        // Validação de Assinatura
        if (secret && xSignature && xRequestId) {
            try {
                const parts = xSignature.split(',');
                let ts = '';
                let v1 = '';
                parts.forEach(part => {
                    const [key, value] = part.split('=');
                    if (key === 'ts') ts = value;
                    if (key === 'v1') v1 = value;
                });

                const resourceId = body.data?.id || body.id;
                const manifest = `id:${resourceId};request-id:${xRequestId};ts:${ts};`;
                const hmac = crypto.createHmac('sha256', secret);
                const digest = hmac.update(manifest).digest('hex');

                if (digest !== v1) {
                    console.error('[WEBHOOK MP] Assinatura Inválida!');
                    if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'FAILED', 'Invalid Signature');
                    return c.json({ success: false, message: 'Invalid signature' }, 401);
                }
            } catch (err: any) {
                console.error('[WEBHOOK MP] Erro validação:', err);
            }
        }

        const paymentId = body.data?.id || (body.type === 'payment' ? body.id : null);

        if (paymentId) {
            const status = await checkPaymentStatus(parseInt(paymentId));

            if (status === 'approved') {
                const result = await executeInTransaction(pool, async (client: PoolClient) => {
                    const txResult = await client.query(
                        "SELECT id FROM transactions WHERE metadata->>'mp_id' = $1 AND status = 'PENDING'",
                        [paymentId.toString()]
                    );

                    if (txResult.rows.length > 0) {
                        const transactionId = txResult.rows[0].id;
                        await processTransactionApproval(client, transactionId, 'APPROVE');
                        return { processed: true, transactionId };
                    }

                    await client.query(
                        "UPDATE transactions SET metadata = metadata || jsonb_build_object('mp_status', $1) WHERE metadata->>'mp_id' = $2",
                        [status, paymentId.toString()]
                    );
                    return { processed: false };
                });

                if (webhookLogId && result.success) {
                    await updateWebhookStatus(pool, webhookLogId, 'COMPLETED');
                }
            } else {
                // Pagamento não aprovado ainda (ex: pending, rejected), apenas logamos o status
                if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'COMPLETED', `Status: ${status}`);
            }
        } else {
            if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'COMPLETED', 'No paymentId found in payload');
        }

        return c.json({ success: true });
    } catch (error: any) {
        console.error('[WEBHOOK MP] Erro:', error);
        if (webhookLogId) await updateWebhookStatus(pool, webhookLogId, 'FAILED', error.message);
        // Retornamos 200 para evitar que o MP fique tentando infinitamente se for erro de lógica nossa,
        // mas o log PENDING/FAILED nos avisará da falha técnica.
        return c.json({ success: false, error: error.message }, 200);
    }
});

export { webhookRoutes };
