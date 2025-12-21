
import {
    MERCADO_PAGO_PIX_FEE_PERCENT,
    MERCADO_PAGO_FIXED_FEE,
    MERCADO_PAGO_CARD_FEE_PERCENT,
    MERCADO_PAGO_CARD_FIXED_FEE
} from '../constants/business.constants';

export type PaymentMethod = 'pix' | 'card' | 'balance';

/**
 * Calcula o custo do gateway para um determinado valor baseado no método
 */
export const calculateGatewayCost = (amount: number, method: PaymentMethod = 'pix'): number => {
    if (!amount || amount <= 0 || method === 'balance') return 0;

    const percent = method === 'pix' ? MERCADO_PAGO_PIX_FEE_PERCENT : MERCADO_PAGO_CARD_FEE_PERCENT;
    const fixed = method === 'pix' ? MERCADO_PAGO_FIXED_FEE : MERCADO_PAGO_CARD_FIXED_FEE;

    const totalCost = (amount * percent) + fixed;
    return Number(totalCost.toFixed(2));
};

/**
 * Calcula o valor total que o usuário deve pagar
 * Se for PIX, o sistema absorve a taxa (Total = Valor Bruto)
 * Se for CARTÃO, a taxa é acrescida (Total = Valor Bruto + Taxa)
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

    // Se o valor for 100 e taxa 1%, queremos (100+0)/0.99 = 101.01
    const total = (amount + fixed) / (1 - percent);
    const fee = total - amount;

    return {
        baseAmount: amount,
        fee: Number(fee.toFixed(2)),
        total: Number(total.toFixed(2))
    };
};
