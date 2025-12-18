
import React, { useEffect, useRef } from 'react';
import { CreditCard, X as XIcon, Loader2 } from 'lucide-react';
import { MP_PUBLIC_KEY } from '../../../shared/constants/app.constants';

interface CardModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    userEmail: string;
    onSubmit: (formData: any) => Promise<void>;
}

declare global {
    interface Window {
        MercadoPago: any;
    }
}

export const CardModal: React.FC<CardModalProps> = ({
    isOpen,
    onClose,
    amount,
    userEmail,
    onSubmit
}) => {
    const brickContainerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    useEffect(() => {
        if (isOpen && window.MercadoPago && brickContainerRef.current) {
            const mp = new window.MercadoPago(MP_PUBLIC_KEY, {
                locale: 'pt-BR'
            });

            const bricksBuilder = mp.bricks();

            const renderPaymentBrick = async (builder: any) => {
                const settings = {
                    initialization: {
                        amount: amount,
                        payer: {
                            email: userEmail,
                        },
                    },
                    customization: {
                        visual: {
                            style: {
                                theme: 'dark', // 'default' | 'dark' | 'bootstrap' | 'flat'
                            },
                        },
                        paymentMethods: {
                            creditCard: 'all',
                            debitCard: 'all',
                            maxInstallments: 12,
                            types: {
                                excluded: ['ticket', 'bank_transfer']
                            }
                        },
                    },
                    callbacks: {
                        onReady: () => {
                            setLoading(false);
                        },
                        onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
                            console.log('Dados do Cartão selecionados:', {
                                method: selectedPaymentMethod,
                                installments: formData.installments,
                                payment_method_id: formData.payment_method_id
                            });

                            setLoading(true);
                            setError(null);
                            try {
                                await onSubmit(formData);
                                onClose();
                            } catch (err: any) {
                                setError(err.message || 'Erro ao processar pagamento');
                            } finally {
                                setLoading(false);
                            }
                        },
                        onError: (error: any) => {
                            console.error('Erro no Brick:', error);
                            setError('Erro ao carregar formulário de pagamento');
                            setLoading(false);
                        },
                    },
                };

                // Limpar container antes de renderizar (evita duplicação)
                if (brickContainerRef.current) {
                    brickContainerRef.current.innerHTML = '';
                }

                window.cardPaymentBrickController = await builder.create(
                    'payment',
                    'paymentBrick_container',
                    settings
                );
            };

            renderPaymentBrick(bricksBuilder);
        }

        return () => {
            // Limpeza se necessário
        };
    }, [isOpen, amount]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-md relative animate-in zoom-in duration-300 my-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-red-500/50 p-2 rounded-full transition-all z-[210] shadow-lg"
                    title="Fechar e cancelar"
                >
                    <XIcon size={24} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="text-primary-400" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Pagamento Seguro</h3>
                    <p className="text-zinc-400 text-sm mt-1">Insira os dados do seu cartão</p>
                </div>

                <div className="bg-background border border-surfaceHighlight rounded-xl p-4 mb-6">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1 uppercase font-bold tracking-wider">
                        <span>Total a Pagar</span>
                    </div>
                    <div className="text-2xl font-bold text-primary-400">
                        {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-4">
                        {error}
                    </div>
                )}

                <div id="paymentBrick_container" ref={brickContainerRef}>
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="text-primary-500 animate-spin" size={40} />
                            <p className="text-zinc-500 text-sm">Carregando formulário seguro...</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                    <button
                        onClick={onClose}
                        className="w-full py-4 text-zinc-500 hover:text-zinc-300 text-sm font-bold border border-zinc-800 rounded-xl transition-all"
                    >
                        Cancelar e Voltar
                    </button>
                </div>

                <p className="text-[10px] text-zinc-500 text-center mt-6 leading-relaxed">
                    Pagamento processado com segurança pelo Mercado Pago. <br />
                    Seus dados de cartão são criptografados e nunca salvos em nosso servidor.
                </p>
            </div>
        </div>
    );
};

// Extensão do objeto window para o controller do brick
declare global {
    interface Window {
        cardPaymentBrickController: any;
    }
}
