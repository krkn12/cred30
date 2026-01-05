import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

export const sellerRoutes = new Hono();

/**
 * GET /seller/status
 * Verifica se o usuário atual é vendedor e seu status
 */
sellerRoutes.get('/status', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const result = await pool.query(
            `SELECT is_seller, seller_status, asaas_wallet_id, seller_company_name 
             FROM users WHERE id = $1`,
            [user.id]
        );

        const userData = result.rows[0];

        return c.json({
            success: true,
            isSeller: userData?.is_seller || false,
            status: userData?.seller_status || null,
            hasWallet: !!userData?.asaas_wallet_id,
            companyName: userData?.seller_company_name || null,
        });
    } catch (error: any) {
        console.error('[SELLER] Erro ao buscar status:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * POST /seller/register
 * Registra o usuário como vendedor (registro local, sem Asaas)
 */
sellerRoutes.post('/register', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const body = await c.req.json();

        // Validar campos obrigatórios
        const {
            companyName,
            cpfCnpj,
            mobilePhone,
            address,
            addressNumber,
            neighborhood,
            city,
            state,
            postalCode
        } = body;

        if (!companyName || !cpfCnpj || !mobilePhone || !address || !city || !state || !postalCode) {
            return c.json({
                success: false,
                message: 'Preencha todos os campos obrigatórios'
            }, 400);
        }

        // Verificar se já é vendedor
        const existingCheck = await pool.query(
            `SELECT is_seller FROM users WHERE id = $1`,
            [user.id]
        );

        if (existingCheck.rows[0]?.is_seller) {
            return c.json({
                success: false,
                message: 'Você já é um vendedor registrado'
            }, 400);
        }

        console.log('[SELLER] Registrando vendedor local:', user.email);

        // Atualizar usuário no banco de dados (sem subconta Asaas)
        await pool.query(
            `UPDATE users SET 
                is_seller = TRUE,
                seller_status = 'approved',
                seller_company_name = $1,
                seller_cpf_cnpj = $2,
                seller_phone = $3,
                seller_address_street = $4,
                seller_address_number = $5,
                seller_address_neighborhood = $6,
                seller_address_city = $7,
                seller_address_state = $8,
                seller_address_postal_code = $9,
                seller_created_at = CURRENT_TIMESTAMP
             WHERE id = $10`,
            [
                companyName,
                cpfCnpj,
                mobilePhone,
                address,
                addressNumber || 'S/N',
                neighborhood || 'Centro',
                city,
                state,
                postalCode,
                user.id
            ]
        );

        console.log('[SELLER] Vendedor registrado localmente:', user.id);

        return c.json({
            success: true,
            message: 'Conta de vendedor criada com sucesso! Os pagamentos serão processados manualmente.',
            seller: {
                status: 'approved',
                paymentMethod: 'MANUAL_PIX'
            }
        });
    } catch (error: any) {
        console.error('[SELLER] Erro ao registrar vendedor:', error);
        return c.json({
            success: false,
            message: error.message || 'Erro ao criar conta de vendedor'
        }, 500);
    }
});

/**
 * GET /seller/wallet
 * Retorna o walletId do vendedor (usado para splits)
 */
sellerRoutes.get('/wallet', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const result = await pool.query(
            `SELECT asaas_wallet_id, asaas_account_id FROM users WHERE id = $1 AND is_seller = TRUE`,
            [user.id]
        );

        if (!result.rows[0]?.asaas_wallet_id) {
            return c.json({
                success: false,
                message: 'Você não é um vendedor registrado'
            }, 404);
        }

        return c.json({
            success: true,
            walletId: result.rows[0].asaas_wallet_id,
            accountId: result.rows[0].asaas_account_id,
        });
    } catch (error: any) {
        console.error('[SELLER] Erro ao buscar wallet:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * GET /seller/:userId/wallet
 * Retorna o walletId de um vendedor específico (para usar em compras)
 */
sellerRoutes.get('/:userId/wallet', authMiddleware, async (c) => {
    try {
        const sellerId = c.req.param('userId');
        const pool = getDbPool(c);

        const result = await pool.query(
            `SELECT asaas_wallet_id, seller_company_name FROM users 
             WHERE id = $1 AND is_seller = TRUE AND seller_status = 'approved'`,
            [sellerId]
        );

        if (!result.rows[0]?.asaas_wallet_id) {
            return c.json({
                success: false,
                message: 'Vendedor não encontrado ou não aprovado'
            }, 404);
        }

        return c.json({
            success: true,
            walletId: result.rows[0].asaas_wallet_id,
            sellerName: result.rows[0].seller_company_name,
        });
    } catch (error: any) {
        console.error('[SELLER] Erro ao buscar wallet do vendedor:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});
