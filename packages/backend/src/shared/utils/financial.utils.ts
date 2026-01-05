// Sistema de PIX Manual - Sem taxas de gateway externo
// O pagamento é feito diretamente para a chave PIX do administrador

export type PaymentMethod = 'pix' | 'balance';

/**
 * Calcula o custo do gateway para um determinado valor baseado no método.
 * Com PIX manual, não há custos de gateway.
 */
export const calculateGatewayCost = (_amount: number, _method: PaymentMethod = 'pix'): number => {
    // PIX manual não tem custos de gateway
    return 0;
};

/**
 * Calcula o valor total que o usuário deve pagar.
 * Com PIX manual, não há taxas de gateway externas.
 * O valor pago é exatamente o valor da transação.
 */
export const calculateTotalToPay = (amount: number, _method: PaymentMethod = 'pix'): {
    baseAmount: number;
    fee: number;
    total: number;
} => {
    // Tanto para saldo quanto para PIX manual, não há taxas adicionais
    // O usuário paga exatamente o valor da transação
    return {
        baseAmount: amount,
        fee: 0,
        total: amount
    };
};
