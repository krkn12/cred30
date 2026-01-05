import {
    ASAAS_PIX_FEE_PERCENT,
    ASAAS_PIX_FIXED_FEE,
    ASAAS_BOLETO_FIXED_FEE,
    ASAAS_CARD_FEE_PERCENT,
    ASAAS_CARD_FIXED_FEE,
    ASAAS_CARD_INSTALLMENTS_FEES
} from '../constants/business.constants';

export type PaymentMethod = 'pix' | 'card' | 'balance' | 'boleto';

// =====================================================
// CONFIGURAÇÃO: ABSORVER TAXAS DO GATEWAY
// =====================================================
// true = Sistema absorve as taxas (usuário paga valor exato)
// false = Usuário paga as taxas (valor + taxa)
const ABSORB_GATEWAY_FEES = true;

/**
 * Retorna as taxas adequadas para o método e parcelamento
 */
const getFeesForMethod = (method: PaymentMethod, installments: number = 1) => {
    switch (method) {
        case 'pix':
            return { percent: ASAAS_PIX_FEE_PERCENT, fixed: ASAAS_PIX_FIXED_FEE };
        case 'boleto':
            return { percent: 0, fixed: ASAAS_BOLETO_FIXED_FEE };
        case 'card':
            let percent = ASAAS_CARD_FEE_PERCENT;
            if (installments > 12) percent = ASAAS_CARD_INSTALLMENTS_FEES['13-21'];
            else if (installments > 6) percent = ASAAS_CARD_INSTALLMENTS_FEES['7-12'];
            else if (installments > 1) percent = ASAAS_CARD_INSTALLMENTS_FEES['2-6'];
            return { percent, fixed: ASAAS_CARD_FIXED_FEE };
        default:
            return { percent: 0, fixed: 0 };
    }
};

/**
 * Calcula o custo do gateway para um determinado valor baseado no método
 */
export const calculateGatewayCost = (amount: number, method: PaymentMethod = 'pix', installments: number = 1): number => {
    if (!amount || amount <= 0 || method === 'balance') return 0;

    const { percent, fixed } = getFeesForMethod(method, installments);
    const totalCost = (amount * percent) + fixed;
    return Number(totalCost.toFixed(2));
};

/**
 * Calcula o valor total que o usuário deve pagar
 * 
 * Se ABSORB_GATEWAY_FEES = true:
 *   → Usuário paga o valor exato (sistema absorve a taxa)
 * 
 * Se ABSORB_GATEWAY_FEES = false:
 *   → Usuário paga valor + taxa (gross-up)
 */
export const calculateTotalToPay = (amount: number, method: PaymentMethod = 'pix', installments: number = 1): {
    baseAmount: number;
    fee: number;
    total: number;
    absorbedBySystem: boolean;
} => {
    if (method === 'balance') {
        return { baseAmount: amount, fee: 0, total: amount, absorbedBySystem: false };
    }

    const { percent, fixed } = getFeesForMethod(method, installments);

    if (ABSORB_GATEWAY_FEES) {
        // Sistema absorve a taxa - usuário paga valor exato
        const fee = (amount * percent) + fixed;
        return {
            baseAmount: amount,
            fee: Number(fee.toFixed(2)),
            total: amount, // Usuário paga só o valor base!
            absorbedBySystem: true
        };
    } else {
        // Usuário paga a taxa (gross-up)
        const total = (amount + fixed) / (1 - percent);
        const fee = total - amount;
        return {
            baseAmount: amount,
            fee: Number(fee.toFixed(2)),
            total: Number(total.toFixed(2)),
            absorbedBySystem: false
        };
    }
};
