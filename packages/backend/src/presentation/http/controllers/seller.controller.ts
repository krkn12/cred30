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
                `SELECT is_seller, seller_status, seller_company_name,
                 merchant_name, restaurant_category, opening_hours, is_restaurant, is_liquor_store, is_paused 
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
                merchantName: userData?.merchant_name || null,
                restaurantCategory: userData?.restaurant_category || null,
                openingHours: userData?.opening_hours || null,
                isRestaurant: userData?.is_restaurant || false,
                isLiquorStore: userData?.is_liquor_store || false,
                isPaused: userData?.is_paused || false
            });
        } catch (error: any) {
            console.error('[SELLER] Erro ao buscar status:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Registrar como vendedor
     */
    /**
     * Registrar como vendedor
     */
    static async registerSeller(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const {
                type, // 'PF' | 'PJ'
                companyName,
                cpfCnpj,
                mobilePhone,
                address,
                addressNumber,
                neighborhood,
                city,
                state,
                postalCode,
                companyType // 'INDIVIDUAL' | 'MEI' | 'ME' | 'LTDA' | 'SA' | 'EIRELI'
            } = body;

            // Validação de Campos Básicos
            if (!type || !cpfCnpj || !mobilePhone || !address || !city || !state || !postalCode) {
                return c.json({
                    success: false,
                    message: 'Preencha todos os campos obrigatórios'
                }, 400);
            }

            // Normalizar Documento (apenas números)
            const cleanDoc = cpfCnpj.replace(/\D/g, '');

            // Validação PF vs PJ
            let finalCompanyName = companyName;

            if (type === 'PF') {
                if (cleanDoc.length !== 11) return c.json({ success: false, message: 'CPF deve ter 11 dígitos.' }, 400);
                if (!companyName) {
                    // Para PF, se não informar nome fantasia, usa o nome do usuário
                    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [user.id]);
                    finalCompanyName = userRes.rows[0]?.name;
                }
            } else if (type === 'PJ') {
                if (cleanDoc.length !== 14) return c.json({ success: false, message: 'CNPJ deve ter 14 dígitos.' }, 400);
                if (!companyName) return c.json({ success: false, message: 'Nome da Empresa é obrigatório para PJ.' }, 400);
                // Validar tipo de empresa para PJ
                if (!companyType || !['MEI', 'ME', 'LTDA', 'SA', 'EIRELI'].includes(companyType)) {
                    return c.json({ success: false, message: 'Tipo de empresa é obrigatório para PJ (MEI, ME, LTDA, SA ou EIRELI).' }, 400);
                }
            } else {
                return c.json({ success: false, message: 'Tipo de conta inválido (Use PF ou PJ).' }, 400);
            }

            // Determinar o tipo de empresa final (INDIVIDUAL para PF, ou o tipo informado para PJ)
            const finalCompanyType = type === 'PF' ? 'INDIVIDUAL' : companyType;

            // Checar duplicidade de Vendedor (Trava de Unicidade)
            const uniqueCheck = await pool.query(
                'SELECT id FROM users WHERE seller_cpf_cnpj = $1 AND id != $2',
                [cleanDoc, user.id]
            );

            if (uniqueCheck.rows.length > 0) {
                return c.json({
                    success: false,
                    message: 'Este CPF/CNPJ já está cadastrado em outra conta de vendedor.'
                }, 409);
            }

            const existingCheck = await pool.query(
                `SELECT is_seller, seller_status, score FROM users WHERE id = $1`,
                [user.id]
            );

            // Permitir re-registro se o status for inválido ('none', null) para corrigir contas bugadas
            if (existingCheck.rows[0]?.is_seller) {
                const currentStatus = existingCheck.rows[0]?.seller_status;
                if (currentStatus === 'approved' || currentStatus === 'pending') {
                    return c.json({
                        success: false,
                        message: 'Você já é um vendedor registrado'
                    }, 400);
                }
            }

            if ((existingCheck.rows[0]?.score || 0) < 0) {
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
                    seller_company_type = $10,
                    seller_created_at = CURRENT_TIMESTAMP
                 WHERE id = $11`,
                [
                    finalCompanyName,
                    cleanDoc,
                    mobilePhone,
                    address,
                    addressNumber || 'S/N',
                    neighborhood || 'Centro',
                    city,
                    state,
                    postalCode,
                    finalCompanyType, // INDIVIDUAL, MEI, ME, LTDA, etc
                    user.id
                ]
            );

            return c.json({
                success: true,
                message: 'Conta de vendedor criada com sucesso! Os pagamentos serão processados manualmente.',
                seller: {
                    status: 'approved',
                    type: type, // Retorna o tipo registrado
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
