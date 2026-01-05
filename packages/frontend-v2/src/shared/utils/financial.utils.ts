import { MARKETPLACE_ESCROW_FEE_RATE as _MARKETPLACE_ESCROW_FEE_RATE } from '../constants/app.constants';

// Sistema de PIX Manual - Sem taxas de gateway externo
// O pagamento é feito diretamente para a chave PIX do administrador
// Taxa fixa apenas para cobrir custos operacionais internos (opcional)
export const PIX_FIXED_FEE = 0.00; // R$ 0,00 - Sem taxa de gateway

export type PaymentMethod = 'pix' | 'balance';

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
