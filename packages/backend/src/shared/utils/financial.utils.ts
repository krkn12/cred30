
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
    if (method === 'pix' || method === 'balance') {
        const fee = calculateGatewayCost(amount, method); // Custo para o sistema
        return {
            baseAmount: amount,
            fee: 0, // Usuário não paga taxa extra no PIX
            total: amount
        };
    }

    // Para outros métodos (cartão), calculamos a taxa para acrescentar
    const fee = calculateGatewayCost(amount, method);
    return {
        baseAmount: amount,
        fee: fee,
        total: Number((amount + fee).toFixed(2))
    };
};
