import { useState, useEffect } from 'react';
import { Truck, Store, CheckCircle, XCircle, Loader2, RefreshCw, User, MapPin, Phone, Car } from 'lucide-react';

interface Partner {
    id: number;
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
    city?: string;
    state?: string;
    vehicle?: string;
    companyName?: string;
    status: string;
    score?: number;
    createdAt: string;
}

interface AdminPartnersProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminPartners = ({ onSuccess, onError }: AdminPartnersProps) => {
    const [tab, setTab] = useState<'couriers' | 'sellers'>('couriers');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [couriers, setCouriers] = useState<Partner[]>([]);
    const [sellers, setSellers] = useState<Partner[]>([]);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

    const vehicleLabels: Record<string, string> = {
        'BIKE': '🚲 Bicicleta',
        'MOTO': '🛵 Moto',
        'CAR': '🚗 Carro',
        'TRUCK': '🚚 Utilitário'
    };

    useEffect(() => {
        loadData();
    }, [tab, filter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('cred30_auth_token');
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

            if (tab === 'couriers') {
                const res = await fetch(`/api/admin/couriers?status=${filter}`, { headers });
                const data = await res.json();
                setCouriers(data.data || []);
            } else {
                const res = await fetch(`/api/admin/sellers?status=${filter}`, { headers });
                const data = await res.json();
                setSellers(data.data || []);
            }
        } catch (e: any) {
            onError('Erro ao Carregar', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (type: 'courier' | 'seller', userId: number) => {
        setActionLoading(userId);
        try {
            const token = localStorage.getItem('cred30_auth_token');
            const endpoint = type === 'courier' ? '/api/admin/couriers/approve' : '/api/admin/sellers/approve';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();

            if (data.success) {
                onSuccess('Aprovado!', data.message);
                loadData();
            } else {
                onError('Erro', data.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (type: 'courier' | 'seller', userId: number) => {
        const reason = prompt('Motivo da rejeição (opcional):');
        setActionLoading(userId);
        try {
            const token = localStorage.getItem('cred30_auth_token');
            const endpoint = type === 'courier' ? '/api/admin/couriers/reject' : '/api/admin/sellers/reject';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, reason })
            });
            const data = await res.json();

            if (data.success) {
                onSuccess('Rejeitado', data.message);
                loadData();
            } else {
                onError('Erro', data.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const partners = tab === 'couriers' ? couriers : sellers;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab('couriers')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition ${tab === 'couriers' ? 'bg-primary-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                    >
                        <Truck size={16} /> Entregadores
                    </button>
                    <button
                        onClick={() => setTab('sellers')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition ${tab === 'sellers' ? 'bg-primary-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                    >
                        <Store size={16} /> Vendedores
                    </button>
                </div>

                <div className="flex gap-2">
                    {(['pending', 'approved', 'rejected'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${filter === f
                                    ? f === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                        : f === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-zinc-800 text-zinc-500'
                                }`}
                        >
                            {f === 'pending' ? 'Pendentes' : f === 'approved' ? 'Aprovados' : 'Rejeitados'}
                        </button>
                    ))}
                    <button onClick={loadData} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition">
                        <RefreshCw size={14} className={`text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="text-primary-500 animate-spin" />
                </div>
            )}

            {/* Empty State */}
            {!loading && partners.length === 0 && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        {tab === 'couriers' ? <Truck size={32} className="text-zinc-600" /> : <Store size={32} className="text-zinc-600" />}
                    </div>
                    <p className="text-zinc-500">Nenhum {tab === 'couriers' ? 'entregador' : 'vendedor'} {filter === 'pending' ? 'pendente' : filter === 'approved' ? 'aprovado' : 'rejeitado'}</p>
                </div>
            )}

            {/* List */}
            {!loading && partners.length > 0 && (
                <div className="space-y-3">
                    {partners.map(p => (
                        <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User size={16} className="text-zinc-500" />
                                        <span className="font-bold text-white truncate">{p.name}</span>
                                        {p.score && (
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                                                {p.score} pts
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                                        {p.email && <span className="truncate">{p.email}</span>}
                                        {p.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone size={12} /> {p.phone}
                                            </span>
                                        )}
                                        {p.city && p.state && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={12} /> {p.city}/{p.state}
                                            </span>
                                        )}
                                        {p.vehicle && (
                                            <span className="flex items-center gap-1">
                                                <Car size={12} /> {vehicleLabels[p.vehicle] || p.vehicle}
                                            </span>
                                        )}
                                        {p.companyName && (
                                            <span className="flex items-center gap-1 col-span-2">
                                                <Store size={12} /> {p.companyName}
                                            </span>
                                        )}
                                        {p.cpf && (
                                            <span className="font-mono">CPF: {p.cpf}</span>
                                        )}
                                    </div>
                                </div>

                                {filter === 'pending' && (
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => handleApprove(tab === 'couriers' ? 'courier' : 'seller', p.id)}
                                            disabled={actionLoading === p.id}
                                            className="flex items-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-bold text-xs transition disabled:opacity-50"
                                        >
                                            {actionLoading === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                            Aprovar
                                        </button>
                                        <button
                                            onClick={() => handleReject(tab === 'couriers' ? 'courier' : 'seller', p.id)}
                                            disabled={actionLoading === p.id}
                                            className="flex items-center gap-1 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-bold text-xs transition disabled:opacity-50"
                                        >
                                            <XCircle size={14} /> Rejeitar
                                        </button>
                                    </div>
                                )}

                                {filter !== 'pending' && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${filter === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {filter === 'approved' ? '✓ Aprovado' : '✗ Rejeitado'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
