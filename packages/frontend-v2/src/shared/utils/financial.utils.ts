import { MARKETPLACE_ESCROW_FEE_RATE } from '../constants/app.constants';

// Taxas do Mercado Pago (Gateway) - Devem estar sincronizadas com o Backend
export const MERCADO_PAGO_PIX_FEE_PERCENT = 0.0099; // 0.99% para PIX
export const MERCADO_PAGO_FIXED_FEE = 0.00; // R$ 0,00 fixo

export const MERCADO_PAGO_CARD_FEE_PERCENT = 0.0499; // 4.99% para Cartão
export const MERCADO_PAGO_CARD_FIXED_FEE = 0.40; // R$ 0,40 fixo

export type PaymentMethod = 'pix' | 'card' | 'balance';

/**
 * Calcula o valor total que o usuário deve pagar com repasse de taxas (Gross-up)
 * Sincronizado com a lógica de proteção do caixa da cooperativa.
 */
export const calculateTotalToPay = (amount: number, method: PaymentMethod = 'pix'): {
    baseAmount: number;
    fee: number;
    total: number;
} => {
    if (method === 'balance') {
        return {
            baseAmount: amount,
            fee: 0,
            total: amount
        };
    }

    // Para métodos externos (PIX e Cartão), usamos a fórmula de Gross-up 
    // para que o valor LÍQUIDO recebido seja exatamente o amount.
    // Fórmula: Total = (Valor + TaxaFixa) / (1 - TaxaPercentual)

    const percent = method === 'pix' ? MERCADO_PAGO_PIX_FEE_PERCENT : MERCADO_PAGO_CARD_FEE_PERCENT;
    const fixed = method === 'pix' ? MERCADO_PAGO_FIXED_FEE : MERCADO_PAGO_CARD_FIXED_FEE;

    const total = (amount + fixed) / (1 - percent);
    const fee = total - amount;

    return {
        baseAmount: amount,
        fee: Number(fee.toFixed(2)),
        total: Number(total.toFixed(2))
    };
};
