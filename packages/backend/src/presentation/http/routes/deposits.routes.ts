import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { USE_ASAAS, ADMIN_PIX_KEY } from '../../../shared/constants/business.constants';
import { createPixPayment } from '../../../infrastructure/gateways/asaas.service';
import { createTransaction } from '../../../domain/services/transaction.service';

const depositRoutes = new Hono();

const depositSchema = z.object({
    amount: z.number().positive(),
});

depositRoutes.post('/request', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { amount } = depositSchema.parse(body);
        const user = c.get('user');
        const pool = getDbPool(c);

        // Buscar CPF e Nome do usuário
        const userRes = await pool.query('SELECT cpf, name, email FROM users WHERE id = $1', [user.id]);
        const userData = userRes.rows[0];

        let pixData = null;
        let externalId = null;

        if (USE_ASAAS) {
            try {
                pixData = await createPixPayment({
                    amount,
                    description: `Depósito Cred30 - ${userData.name}`,
                    email: userData.email,
                    external_reference: `DEP_${user.id}_${Date.now()}`,
                    cpf: userData.cpf,
                    name: userData.name
                });
                externalId = pixData?.id;
            } catch (err) {
                console.error('[DEPOSIT] Erro Asaas:', err);
            }
        }

        // Criar transação pendente
        const transaction = await createTransaction(
            pool,
            user.id,
            'DEPOSIT',
            amount,
            `Depósito de Saldo (${USE_ASAAS ? 'Asaas' : 'Manual'})`,
            'PENDING',
            {
                asaas_id: externalId,
                is_manual: !USE_ASAAS
            }
        );

        return c.json({
            success: true,
            message: USE_ASAAS ? 'PIX gerado com sucesso!' : 'Dados para depósito manual gerados.',
            data: {
                transactionId: transaction.transactionId,
                amount,
                pixData,
                manualPix: !USE_ASAAS ? {
                    key: ADMIN_PIX_KEY,
                    owner: 'Admin Cred30',
                    description: `Transferir R$ ${amount.toFixed(2)} para adicionar saldo`
                } : null
            }
        });

    } catch (error) {
        console.error('[DEPOSIT] Erro:', error);
        return c.json({ success: false, message: 'Erro ao solicitar depósito' }, 500);
    }
});

export { depositRoutes };
