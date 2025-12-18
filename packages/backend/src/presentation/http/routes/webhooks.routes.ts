import { Hono } from 'hono';
import { PoolClient } from 'pg';
import crypto from 'crypto';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { checkPaymentStatus } from '../../../infrastructure/gateways/mercadopago.service';
import { executeInTransaction, processTransactionApproval } from '../../../domain/services/transaction.service';

const webhookRoutes = new Hono();

webhookRoutes.post('/mercadopago', async (c) => {
    try {
        const body = await c.req.json();
        const xSignature = c.req.header('x-signature');
        const xRequestId = c.req.header('x-request-id');
        const secret = process.env.MP_WEBHOOK_SECRET;

        console.log('[WEBHOOK MP] Recebido:', JSON.stringify(body));

        // Validação de Assinatura (Opcional se secret não estiver definido, mas recomendado)
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
                    return c.json({ success: false, message: 'Invalid signature' }, 401);
                }
                console.log('[WEBHOOK MP] Assinatura Validada com Sucesso');
            } catch (err) {
                console.error('[WEBHOOK MP] Erro ao validar assinatura:', err);
                // Em caso de erro na validação, por segurança, podemos recusar ou apenas logar
                // Aqui vamos apenas logar para não quebrar integrações antigas, mas o ideal seria retornar erro
            }
        }

        // Suporte para payment.id no corpo ou body.data.id
        const paymentId = body.data?.id || (body.type === 'payment' ? body.id : null);

        if (paymentId) {
            const status = await checkPaymentStatus(parseInt(paymentId));
            console.log(`[WEBHOOK MP] Status do pagamento ${paymentId}: ${status}`);

            if (status === 'approved') {
                const pool = getDbPool(c);

                await executeInTransaction(pool, async (client: PoolClient) => {
                    // Buscar a transação associada a este mp_id
                    const txResult = await client.query(
                        "SELECT id FROM transactions WHERE metadata->>'mp_id' = $1 AND status = 'PENDING'",
                        [paymentId.toString()]
                    );

                    if (txResult.rows.length > 0) {
                        const transactionId = txResult.rows[0].id;
                        console.log(`[WEBHOOK MP] Automatizando aprovação da transação ${transactionId}`);
                        await processTransactionApproval(client, transactionId, 'APPROVE');
                    } else {
                        // Tentar atualizar apenas o metadata se não encontrar para aprovar (ex: já aprovada)
                        await client.query(
                            "UPDATE transactions SET metadata = metadata || jsonb_build_object('mp_status', $1) WHERE metadata->>'mp_id' = $2",
                            [status, paymentId.toString()]
                        );
                    }
                });
            }
        }

        return c.json({ success: true });
    } catch (error) {
        console.error('[WEBHOOK MP] Erro:', error);
        return c.json({ success: false, message: 'Internal Server Error' }, 200);
    }
});

export { webhookRoutes };
