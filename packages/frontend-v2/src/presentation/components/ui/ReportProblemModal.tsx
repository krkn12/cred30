import React, { useState } from 'react';
import { X, AlertTriangle, Send, Package, Car, Shield } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface ReportProblemModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: number;
    onSuccess: () => void;
}

const CLAIM_TYPES = [
    { value: 'LOST', label: 'Produto Perdido', icon: Package, description: 'O produto foi extraviado durante o transporte' },
    { value: 'DAMAGED', label: 'Produto Danificado', icon: Package, description: 'O produto sofreu danos durante a entrega' },
    { value: 'ACCIDENT', label: 'Acidente/Imprevisto', icon: Car, description: 'Sofri um acidente ou imprevisto que impede a entrega' },
    { value: 'THEFT', label: 'Roubo/Assalto', icon: Shield, description: 'Fui vítima de roubo ou assalto' },
    { value: 'OTHER', label: 'Outro Problema', icon: AlertTriangle, description: 'Outro tipo de problema não listado' },
];

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({ isOpen, onClose, orderId, onSuccess }) => {
    const [claimType, setClaimType] = useState<string>('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!claimType) {
            setError('Selecione o tipo de problema');
            return;
        }
        if (description.length < 10) {
            setError('Descreva o ocorrido com pelo menos 10 caracteres');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await apiService.createClaim(orderId, claimType, description);
            if (result.success) {
                onSuccess();
                onClose();
            } else {
                setError(result.message || 'Erro ao reportar problema');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao reportar problema');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-800">
                {/* Header */}
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle size={20} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Reportar Problema</h2>
                            <p className="text-xs text-zinc-500">Pedido #{orderId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
                        <X size={20} className="text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Aviso */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-amber-400 text-sm">
                            ⚠️ <strong>Importante:</strong> Use esta função apenas para emergências reais.
                            Reportes falsos resultarão em penalidades severas e possível banimento.
                        </p>
                    </div>

                    {/* Tipo de Problema */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                            Tipo de Problema
                        </label>
                        <div className="space-y-2">
                            {CLAIM_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    onClick={() => setClaimType(type.value)}
                                    className={`w-full p-3 rounded-xl border transition-all flex items-start gap-3 text-left
                                        ${claimType === type.value
                                            ? 'bg-red-500/20 border-red-500 text-white'
                                            : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                                        }`}
                                >
                                    <type.icon size={20} className={claimType === type.value ? 'text-red-500' : 'text-zinc-500'} />
                                    <div>
                                        <p className="font-medium">{type.label}</p>
                                        <p className="text-xs text-zinc-500">{type.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                            Descreva o ocorrido
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explique em detalhes o que aconteceu..."
                            rows={4}
                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 text-white 
                                       placeholder:text-zinc-500 focus:border-red-500 focus:outline-none resize-none"
                        />
                        <p className="text-xs text-zinc-500 mt-1">{description.length}/500 caracteres</p>
                    </div>

                    {/* Erro */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Botões */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 
                                       disabled:opacity-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !claimType || description.length < 10}
                            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold flex items-center justify-center gap-2
                                       disabled:opacity-50 hover:bg-red-600 transition-colors"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send size={18} />
                                    Enviar Relatório
                                </>
                            )}
                        </button>
                    </div>

                    {/* Info */}
                    <p className="text-xs text-zinc-500 text-center">
                        Nossa equipe analisará o caso em até 24 horas. Você será notificado sobre a resolução.
                    </p>
                </div>
            </div>
        </div>
    );
};
