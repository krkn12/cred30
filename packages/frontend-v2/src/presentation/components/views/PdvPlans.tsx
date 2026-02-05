import React, { useState } from 'react';
import { Check, Shield, Zap, Store, Star } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface PdvPlansProps {
    onSuccess: (message: string) => void;
    onError: (title: string, message: string) => void;
}

export const PdvPlans = ({ onSuccess, onError }: PdvPlansProps) => {
    const [isLoading, setIsLoading] = useState<string | null>(null);

    const plans = [
        {
            code: 'BASIC',
            name: 'Básico',
            price: 29.90,
            description: 'Para quem está começando',
            features: [
                '1 Máquina PDV',
                'Controle de Vendas',
                'Relatórios Básicos',
                'Catálogo de Produtos'
            ],
            icon: Store,
            color: 'from-blue-500 to-blue-600',
            popular: false
        },
        {
            code: 'PRO',
            name: 'Profissional',
            price: 59.90,
            description: 'Para lojas em crescimento',
            features: [
                'até 3 Máquinas Sincronizadas',
                'Controle de Estoque Avançado',
                'Suporte Prioritário',
                'Todas as funções do Básico'
            ],
            icon: Zap,
            color: 'from-primary-500 to-primary-600',
            popular: true
        },
        {
            code: 'ENTERPRISE',
            name: 'Enterprise',
            price: 99.90,
            description: 'Para grandes operações',
            features: [
                'Máquinas Ilimitadas',
                'API de Integração',
                'Gerente de Conta Dedicado',
                'Múltiplas Lojas (Em breve)'
            ],
            icon: Star,
            color: 'from-purple-500 to-purple-600',
            popular: false
        }
    ];

    const handleSubscribe = async (plan: string) => {
        setIsLoading(plan);
        try {
            const res = await apiService.post<any>('/pdv/subscribe', { plan });
            if (res.success) {
                onSuccess(`Assinatura ${plan} ativada com sucesso!`);
            } else {
                onError('Erro ao Assinar', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message || 'Falha ao processar assinatura.');
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="text-center space-y-2 pt-6">
                <h2 className="text-3xl font-black text-white tracking-tighter">
                    PDV <span className="text-primary-400">CRED30</span>
                </h2>
                <p className="text-zinc-400 max-w-xs mx-auto text-sm">
                    Transforme seu negócio com nosso sistema de vendas completo e sincronizado.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {plans.map((plan) => (
                    <div
                        key={plan.code}
                        className={`relative bg-zinc-900/80 border ${plan.popular ? 'border-primary-500 ring-1 ring-primary-500/50' : 'border-zinc-800'} rounded-3xl p-6 flex flex-col`}
                    >
                        {plan.popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-primary-500/20">
                                Mais Popular
                            </div>
                        )}

                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4 shadow-lg`}>
                            <plan.icon size={24} className="text-white" />
                        </div>

                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        <p className="text-zinc-500 text-xs mt-1 h-8">{plan.description}</p>

                        <div className="mt-4 mb-6">
                            <span className="text-sm text-zinc-400 font-bold">R$</span>
                            <span className="text-4xl font-black text-white tracking-tighter">{plan.price.toFixed(2).replace('.', ',')}</span>
                            <span className="text-zinc-500 text-xs font-bold">/mês</span>
                        </div>

                        <ul className="space-y-3 mb-8 flex-1">
                            {plan.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300">
                                    <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-xs font-medium">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => handleSubscribe(plan.code)}
                            disabled={!!isLoading}
                            className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all
                                ${plan.popular
                                    ? 'bg-gradient-to-r from-primary-500 to-primary-400 text-black hover:shadow-lg hover:shadow-primary-500/20'
                                    : 'bg-white text-black hover:bg-zinc-200'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        >
                            {isLoading === plan.code ? 'Processando...' : 'Escolher Plano'}
                        </button>
                    </div>
                ))}
            </div>

            <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4 max-w-md mx-auto">
                <Shield size={24} className="text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-zinc-400">
                    <strong className="text-emerald-400 block mb-0.5">Garantia de 7 dias</strong>
                    Se não gostar, devolvemos seu dinheiro integralmente. Sem perguntas.
                </p>
            </div>
        </div>
    );
};
