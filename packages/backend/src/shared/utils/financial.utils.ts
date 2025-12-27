import {
    ASAAS_PIX_FEE_PERCENT,
    ASAAS_PIX_FIXED_FEE,
    ASAAS_BOLETO_FIXED_FEE,
    ASAAS_CARD_FEE_PERCENT,
    ASAAS_CARD_FIXED_FEE,
    ASAAS_CARD_INSTALLMENTS_FEES
} from '../constants/business.constants';

export type PaymentMethod = 'pix' | 'card' | 'balance' | 'boleto';

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
 * Calcula o valor total que o usuário deve pagar (Gross-up)
 * Total = (Valor + TaxaFixa) / (1 - TaxaPercentual)
 */
export const calculateTotalToPay = (amount: number, method: PaymentMethod = 'pix', installments: number = 1): {
    baseAmount: number;
    fee: number;
    total: number;
} => {
    if (method === 'balance') {
        return { baseAmount: amount, fee: 0, total: amount };
    }

    const { percent, fixed } = getFeesForMethod(method, installments);

    const total = (amount + fixed) / (1 - percent);
    const fee = total - amount;

    return {
        baseAmount: amount,
        fee: Number(fee.toFixed(2)),
        total: Number(total.toFixed(2))
    };
};
