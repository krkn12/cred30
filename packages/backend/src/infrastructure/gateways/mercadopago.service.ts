import { MercadoPagoConfig, Payment } from 'mercadopago';
import { v4 as uuidv4 } from 'uuid';

const mpAccessToken = process.env.MP_ACCESS_TOKEN || '';

const client = new MercadoPagoConfig({
    accessToken: mpAccessToken,
    options: { timeout: 10000 }
});

const payment = new Payment(client);

export interface PaymentRequest {
    amount: number;
    description: string;
    email: string;
    external_reference?: string;
    token?: string; // Para cartão de crédito
    installments?: number;
    payment_method_id?: string;
    issuer_id?: number;
}

export interface PaymentResponse {
    id: number;
    qr_code?: string;
    qr_code_base64?: string;
    status: string;
    external_reference: string;
    payment_method_id?: string;
}

/**
 * Cria um pagamento via PIX
 */
export const createPixPayment = async (data: PaymentRequest): Promise<PaymentResponse> => {
    try {
        const external_reference = data.external_reference || uuidv4();

        const body = {
            transaction_amount: data.amount,
            description: data.description,
            payment_method_id: 'pix',
            external_reference: external_reference,
            payer: {
                email: data.email,
            },
            installments: 1,
        };

        const response = await payment.create({ body });

        if (!response.point_of_interaction?.transaction_data) {
            throw new Error('Erro ao gerar dados do PIX: ' + (response as any).message);
        }

        return {
            id: response.id!,
            qr_code: response.point_of_interaction.transaction_data.qr_code!,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64!,
            status: response.status!,
            external_reference: response.external_reference!,
            payment_method_id: 'pix'
        };
    } catch (error: any) {
        console.error('Erro Mercado Pago PIX:', error);
        throw new Error(error.message || 'Falha ao processar pagamento com Mercado Pago');
    }
};

/**
 * Cria um pagamento via Cartão de Crédito (Checkout Transparente)
 */
export const createCardPayment = async (data: PaymentRequest): Promise<PaymentResponse> => {
    try {
        const external_reference = data.external_reference || uuidv4();

        const body = {
            transaction_amount: data.amount,
            description: data.description,
            payment_method_id: data.payment_method_id,
            token: data.token,
            installments: data.installments || 1,
            issuer_id: data.issuer_id,
            external_reference: external_reference,
            payer: {
                email: data.email,
            }
        };

        const response = await payment.create({ body });

        return {
            id: response.id!,
            status: response.status!,
            external_reference: response.external_reference!,
            payment_method_id: response.payment_method_id
        };
    } catch (error: any) {
        console.error('Erro Mercado Pago Cartão:', error);
        throw new Error(error.message || 'Falha ao processar cartão com Mercado Pago');
    }
};

/**
 * Consulta status de um pagamento
 */
export const checkPaymentStatus = async (paymentId: number) => {
    try {
        const response = await payment.get({ id: paymentId });
        return response.status;
    } catch (error) {
        console.error('Erro consulta Mercado Pago:', error);
        throw error;
    }
};
/**
 * Simula aprovação de um pagamento (Apenas Sandbox)
 */
export const simulatePaymentApproval = async (paymentId: number) => {
    try {
        // No SDK v2, o método update não existe diretamente no objeto Payment.
        // Usamos fetch diretamente para fazer uma requisição à API para fins de simulação.
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${mpAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'approved' })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao atualizar status no Mercado Pago');
        }

        const data = await response.json();
        return data.status;
    } catch (error: any) {
        console.error('Erro ao simular aprovação Mercado Pago:', error);
        throw error;
    }
};
