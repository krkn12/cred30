import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';

export class SellerController {
    /**
     * Verificar status do vendedor
     */
    static async getStatus(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT is_seller, seller_status, seller_company_name 
                 FROM users WHERE id = $1`,
                [user.id]
            );

            const userData = result.rows[0];

            return c.json({
                success: true,
                isSeller: userData?.is_seller || false,
                status: userData?.seller_status || null,
                // hasWallet agora é derivado de is_seller + seller_status approved
                hasWallet: userData?.is_seller && userData?.seller_status === 'approved',
                companyName: userData?.seller_company_name || null,
            });
        } catch (error: any) {
            console.error('[SELLER] Erro ao buscar status:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Registrar como vendedor
     */
    static async registerSeller(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

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

            const existingCheck = await pool.query(
                `SELECT is_seller, score FROM users WHERE id = $1`,
                [user.id]
            );

            if (existingCheck.rows[0]?.is_seller) {
                return c.json({
                    success: false,
                    message: 'Você já é um vendedor registrado'
                }, 400);
            }

            if ((existingCheck.rows[0]?.score || 0) < 300) {
                return c.json({
                    success: false,
                    message: 'Score insuficiente. Você precisa de no mínimo 300 pontos de Score (obtidos via investimentos/compras) para abrir uma loja.'
                }, 403);
            }

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
    }

    /**
     * Verificar se vendedor está aprovado (usado internamente pelo sistema)
     */
    static async getWallet(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT is_seller, seller_status, pix_key FROM users WHERE id = $1 AND is_seller = TRUE`,
                [user.id]
            );

            if (!result.rows[0] || result.rows[0].seller_status !== 'approved') {
                return c.json({
                    success: false,
                    message: 'Você não é um vendedor aprovado'
                }, 404);
            }

            return c.json({
                success: true,
                // Retornamos o pix_key do usuário como "wallet" para pagamentos manuais
                walletId: result.rows[0].pix_key || 'MANUAL_PAYMENT',
                paymentMethod: 'MANUAL_PIX'
            });
        } catch (error: any) {
            console.error('[SELLER] Erro ao buscar wallet:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Verificar se um vendedor específico está aprovado
     */
    static async getSellerWalletById(c: Context) {
        try {
            const sellerId = c.req.param('userId');
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT is_seller, seller_status, seller_company_name, pix_key FROM users 
                 WHERE id = $1 AND is_seller = TRUE AND seller_status = 'approved'`,
                [sellerId]
            );

            if (!result.rows[0]) {
                return c.json({
                    success: false,
                    message: 'Vendedor não encontrado ou não aprovado'
                }, 404);
            }

            return c.json({
                success: true,
                walletId: result.rows[0].pix_key || 'MANUAL_PAYMENT',
                sellerName: result.rows[0].seller_company_name,
                paymentMethod: 'MANUAL_PIX'
            });
        } catch (error: any) {
            console.error('[SELLER] Erro ao buscar wallet do vendedor:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
