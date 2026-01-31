import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-react';
import { apiService } from '../../../../application/services/api.service';

interface Claim {
    id: number;
    order_id: number;
    courier_id: number;
    claim_type: string;
    description: string;
    evidence_urls: string[];
    status: string;
    created_at: string;
    courier_name: string;
    courier_email: string;
    seller_name: string;
    buyer_name: string;
    product_title: string;
    product_price: number;
    order_amount: number;
    delivery_fee: number;
    insurance_available: number;
    admin_notes?: string;
    resolved_by_name?: string;
    resolved_at?: string;
}

const CLAIM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    LOST: { label: 'Perdido', color: 'text-red-400 bg-red-500/10' },
    DAMAGED: { label: 'Danificado', color: 'text-amber-400 bg-amber-500/10' },
    ACCIDENT: { label: 'Acidente', color: 'text-orange-400 bg-orange-500/10' },
    THEFT: { label: 'Roubo', color: 'text-red-400 bg-red-500/10' },
    OTHER: { label: 'Outro', color: 'text-zinc-400 bg-zinc-500/10' },
};

export const AdminClaimsTab: React.FC = () => {
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [resolveData, setResolveData] = useState({
        status: 'APPROVED' as 'APPROVED' | 'REJECTED',
        sellerRefund: 0,
        buyerRefund: 0,
        courierPenalty: 0,
        adminNotes: ''
    });
    const [resolving, setResolving] = useState(false);

    const loadClaims = async () => {
        setLoading(true);
        try {
            const result = await apiService.listClaims(statusFilter);
            if (result.success) {
                setClaims(result.data || []);
            }
        } catch (error) {
            console.error('Erro ao carregar claims:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClaims();
    }, [statusFilter]);

    const handleResolve = async () => {
        if (!selectedClaim) return;
        setResolving(true);
        try {
            const result = await apiService.resolveClaim(selectedClaim.id, resolveData);
            if (result.success) {
                setSelectedClaim(null);
                loadClaims();
            }
        } catch (error) {
            console.error('Erro ao resolver claim:', error);
        } finally {
            setResolving(false);
        }
    };

    const formatCurrency = (value: number | string) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return `R$ ${(num || 0).toFixed(2)}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={24} />
                        Incidentes de Entrega
                    </h2>
                    <p className="text-zinc-500 text-sm">Gerencie claims e reembolsos do sistema de seguro</p>
                </div>
                <button
                    onClick={loadClaims}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors ${statusFilter === status
                            ? status === 'PENDING' ? 'bg-amber-500/20 text-amber-400'
                                : status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        {status === 'PENDING' ? 'Pendentes' : status === 'APPROVED' ? 'Aprovados' : 'Rejeitados'}
                    </button>
                ))}
            </div>

            {/* Lista de Claims */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : claims.length === 0 ? (
                <div className="text-center py-20">
                    <AlertTriangle size={48} className="text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500">Nenhum incidente {statusFilter === 'PENDING' ? 'pendente' : ''}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {claims.map(claim => (
                        <div key={claim.id} className="glass p-4 rounded-2xl border border-white/5 hover:border-red-500/30 transition-all">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex gap-3">
                                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                                        <AlertTriangle className="text-red-500" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">Claim #{claim.id}</h3>
                                        <p className="text-xs text-zinc-500">Pedido #{claim.order_id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${CLAIM_TYPE_LABELS[claim.claim_type]?.color || 'text-zinc-400 bg-zinc-500/10'}`}>
                                        {CLAIM_TYPE_LABELS[claim.claim_type]?.label || claim.claim_type}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setSelectedClaim(claim);
                                            setResolveData({
                                                status: 'APPROVED',
                                                sellerRefund: parseFloat(claim.product_price?.toString() || '0'),
                                                buyerRefund: parseFloat(claim.order_amount?.toString() || '0'),
                                                courierPenalty: 0,
                                                adminNotes: ''
                                            });
                                        }}
                                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                    >
                                        <Eye size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="bg-zinc-900/50 p-2 rounded-lg">
                                    <p className="text-zinc-500">Entregador</p>
                                    <p className="text-white font-medium">{claim.courier_name}</p>
                                </div>
                                <div className="bg-zinc-900/50 p-2 rounded-lg">
                                    <p className="text-zinc-500">Produto</p>
                                    <p className="text-white font-medium truncate">{claim.product_title}</p>
                                </div>
                                <div className="bg-zinc-900/50 p-2 rounded-lg">
                                    <p className="text-zinc-500">Seguro Disponível</p>
                                    <p className="text-emerald-400 font-medium">{formatCurrency(claim.insurance_available || 0)}</p>
                                </div>
                                <div className="bg-zinc-900/50 p-2 rounded-lg">
                                    <p className="text-zinc-500">Data</p>
                                    <p className="text-white font-medium">{new Date(claim.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="mt-3 p-3 bg-zinc-900/30 rounded-xl">
                                <p className="text-xs text-zinc-500 mb-1 font-bold">DESCRIÇÃO:</p>
                                <p className="text-sm text-zinc-300">{claim.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Resolução */}
            {selectedClaim && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-800">
                        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">Resolver Claim #{selectedClaim.id}</h2>
                            <button onClick={() => setSelectedClaim(null)} className="p-2 hover:bg-zinc-800 rounded-lg">
                                <XCircle size={20} className="text-zinc-400" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Info do Claim */}
                            <div className="bg-zinc-800/50 p-4 rounded-xl space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Tipo:</span>
                                    <span className="text-white font-bold">{CLAIM_TYPE_LABELS[selectedClaim.claim_type]?.label}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Entregador:</span>
                                    <span className="text-white">{selectedClaim.courier_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Produto:</span>
                                    <span className="text-white">{selectedClaim.product_title}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Seguro Disponível:</span>
                                    <span className="text-emerald-400 font-bold">{formatCurrency(selectedClaim.insurance_available || 0)}</span>
                                </div>
                            </div>

                            {/* Decisão */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Decisão</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setResolveData(d => ({ ...d, status: 'APPROVED' }))}
                                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${resolveData.status === 'APPROVED'
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 border'
                                            : 'bg-zinc-800 text-zinc-400'
                                            }`}
                                    >
                                        <CheckCircle size={18} /> Aprovar
                                    </button>
                                    <button
                                        onClick={() => setResolveData(d => ({ ...d, status: 'REJECTED' }))}
                                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${resolveData.status === 'REJECTED'
                                            ? 'bg-red-500/20 border-red-500 text-red-400 border'
                                            : 'bg-zinc-800 text-zinc-400'
                                            }`}
                                    >
                                        <XCircle size={18} /> Rejeitar
                                    </button>
                                </div>
                            </div>

                            {/* Campos de valores (se aprovado) */}
                            {resolveData.status === 'APPROVED' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Reembolso ao Vendedor (R$)</label>
                                        <input
                                            type="number"
                                            value={resolveData.sellerRefund}
                                            onChange={(e) => setResolveData(d => ({ ...d, sellerRefund: parseFloat(e.target.value) || 0 }))}
                                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Reembolso ao Comprador (R$)</label>
                                        <input
                                            type="number"
                                            value={resolveData.buyerRefund}
                                            onChange={(e) => setResolveData(d => ({ ...d, buyerRefund: parseFloat(e.target.value) || 0 }))}
                                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Penalidade ao Entregador (R$)</label>
                                        <input
                                            type="number"
                                            value={resolveData.courierPenalty}
                                            onChange={(e) => setResolveData(d => ({ ...d, courierPenalty: parseFloat(e.target.value) || 0 }))}
                                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 text-white focus:border-red-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Notas do Admin */}
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Notas (opcional)</label>
                                <textarea
                                    value={resolveData.adminNotes}
                                    onChange={(e) => setResolveData(d => ({ ...d, adminNotes: e.target.value }))}
                                    rows={3}
                                    placeholder="Justificativa ou observações..."
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 text-white 
                                               placeholder:text-zinc-500 focus:border-primary-500 focus:outline-none resize-none"
                                />
                            </div>

                            {/* Botão de ação */}
                            <button
                                onClick={handleResolve}
                                disabled={resolving}
                                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                                    ${resolveData.status === 'APPROVED'
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white'
                                    } disabled:opacity-50`}
                            >
                                {resolving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {resolveData.status === 'APPROVED' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                        {resolveData.status === 'APPROVED' ? 'Aprovar e Processar Reembolsos' : 'Rejeitar Claim'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
