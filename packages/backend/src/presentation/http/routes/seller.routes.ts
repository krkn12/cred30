import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
    createSubAccount,
    getSubAccount,
    SubAccountRequest
} from '../../../infrastructure/gateways/asaas.service';

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
 * Registra o usuário como vendedor e cria subconta no Asaas
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
            postalCode,
            companyType = 'INDIVIDUAL'
        } = body;

        if (!companyName || !cpfCnpj || !mobilePhone || !address || !city || !state || !postalCode) {
            return c.json({
                success: false,
                message: 'Preencha todos os campos obrigatórios'
            }, 400);
        }

        // Verificar se já é vendedor
        const existingCheck = await pool.query(
            `SELECT is_seller, asaas_account_id FROM users WHERE id = $1`,
            [user.id]
        );

        if (existingCheck.rows[0]?.is_seller && existingCheck.rows[0]?.asaas_account_id) {
            return c.json({
                success: false,
                message: 'Você já é um vendedor registrado'
            }, 400);
        }

        // Criar subconta no Asaas
        const subAccountData: SubAccountRequest = {
            name: companyName,
            email: user.email,
            cpfCnpj: cpfCnpj,
            companyType: companyType,
            mobilePhone: mobilePhone,
            address: address,
            addressNumber: addressNumber || 'S/N',
            province: neighborhood || 'Centro',
            city: city,
            state: state,
            postalCode: postalCode,
        };

        console.log('[SELLER] Criando subconta para:', user.email);

        const subAccount = await createSubAccount(subAccountData);

        // Atualizar usuário no banco de dados
        await pool.query(
            `UPDATE users SET 
                is_seller = TRUE,
                seller_status = 'approved',
                asaas_account_id = $1,
                asaas_wallet_id = $2,
                seller_company_name = $3,
                seller_cpf_cnpj = $4,
                seller_phone = $5,
                seller_address_street = $6,
                seller_address_number = $7,
                seller_address_neighborhood = $8,
                seller_address_city = $9,
                seller_address_state = $10,
                seller_address_postal_code = $11,
                seller_created_at = CURRENT_TIMESTAMP
             WHERE id = $12`,
            [
                subAccount.id,
                subAccount.walletId,
                companyName,
                cpfCnpj,
                mobilePhone,
                address,
                addressNumber,
                neighborhood,
                city,
                state,
                postalCode,
                user.id
            ]
        );

        console.log('[SELLER] Vendedor registrado:', user.id, 'Wallet:', subAccount.walletId);

        return c.json({
            success: true,
            message: 'Conta de vendedor criada com sucesso!',
            seller: {
                accountId: subAccount.id,
                walletId: subAccount.walletId,
                status: 'approved',
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
