import { useState, useEffect } from 'react';
import { apiService } from '../../../application/services/api.service';
import { AppState } from '../../../domain/types/common.types';
import { PdvPlans } from './PdvPlans';
import { PdvDashboard } from './PdvDashboard';
import { PdvPos } from './PdvPos';
import { Loader2 } from 'lucide-react';

interface PdvViewProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const PdvView = ({ onSuccess, onError }: PdvViewProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [isPosOpen, setIsPosOpen] = useState(false);

    // Verificar status da assinatura ao carregar
    const checkSubscription = async () => {
        setIsLoading(true);
        try {
            const res = await apiService.get<any>('/pdv/subscription');
            // Suporte para ambas as estruturas de resposta (com ou sem 'data')
            const data = res.data || res;

            if (res.success && data.hasSubscription) {
                setSubscription(data.subscription);
            } else {
                setSubscription(null);
            }
        } catch (error) {
            console.error('Erro ao verificar assinatura PDV:', error);
            // Se der erro (ex: 404), assumimos sem assinatura
            setSubscription(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkSubscription();
    }, []);

    const handleCancelSubscription = async () => {
        if (!confirm('Tem certeza? Suas vendas e dados serão mantidos, mas o acesso será bloqueado ao fim do período.')) return;

        try {
            const res = await apiService.post('/pdv/subscription/cancel', {});
            if ((res as any).success) {
                onSuccess('Assinatura Cancelada', 'Sua assinatura não será renovada.');
                checkSubscription();
            } else {
                onError('Erro', (res as any).message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-primary-400 mb-4" size={32} />
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Carregando Sistema PDV...</p>
            </div>
        );
    }

    // Se o Caixa estiver aberto, ele ocupa a tela toda (Full Screen Overlay)
    if (isPosOpen) {
        return (
            <PdvPos
                onClose={() => setIsPosOpen(false)}
            />
        );
    }

    // Se usuário tem assinatura ativa, mostra Dashboard
    if (subscription && subscription.status === 'ACTIVE') {
        return (
            <PdvDashboard
                subscription={subscription}
                onOpenPos={() => setIsPosOpen(true)}
                onCancelSubscription={handleCancelSubscription}
            />
        );
    }

    // Se não tem assinatura, mostra Planos
    return (
        <PdvPlans
            onSuccess={(msg) => {
                onSuccess('Bem-vindo!', msg);
                checkSubscription(); // Recarrega para entrar no Dashboard
            }}
            onError={(t, m) => onError(t, m)}
        />
    );
};
