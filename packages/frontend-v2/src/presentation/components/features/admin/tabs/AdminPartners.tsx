import { useState, useEffect, useCallback } from 'react';
import { Truck, Store, CheckCircle, XCircle, Loader2, RefreshCw, User, MapPin, Phone, Search, ShieldCheck } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

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
    const [searchTerm, setSearchTerm] = useState('');

    const vehicleLabels: Record<string, string> = {
        'BIKE': '🚲 Bicicleta',
        'MOTO': '🛵 Moto',
        'CAR': '🚗 Carro',
        'TRUCK': '🚚 Utilitário'
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = tab === 'couriers' ? `/admin/couriers?status=${filter}` : `/admin/sellers?status=${filter}`;
            const response = await apiService.get<any>(endpoint);

            if (response.success) {
                if (tab === 'couriers') {
                    setCouriers(Array.isArray(response.data) ? response.data : []);
                } else {
                    setSellers(Array.isArray(response.data) ? response.data : []);
                }
            } else {
                onError('Erro', response.message || 'Falha ao carregar dados');
            }
        } catch (e: any) {
            onError('Erro de Conexão', e.message);
        } finally {
            setLoading(false);
        }
    }, [tab, filter, onError]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleApprove = async (type: 'courier' | 'seller', userId: number) => {
        setActionLoading(userId);
        try {
            const endpoint = type === 'courier' ? '/admin/couriers/approve' : '/admin/sellers/approve';
            const res = await apiService.post<any>(endpoint, { userId });

            if (res.success) {
                onSuccess('Parceiro Ativado!', res.message);
                loadData();
            } else {
                onError('Erro', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (type: 'courier' | 'seller', userId: number) => {
        const reason = prompt('Descreva o motivo da rejeição para o usuário:');
        if (reason === null) return; // Cancelou o prompt

        setActionLoading(userId);
        try {
            const endpoint = type === 'courier' ? '/admin/couriers/reject' : '/admin/sellers/reject';
            const res = await apiService.post<any>(endpoint, { userId, reason });

            if (res.success) {
                onSuccess('Cadastro Rejeitado', res.message);
                loadData();
            } else {
                onError('Erro', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const partners = tab === 'couriers' ? couriers : sellers;
    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.companyName && p.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Seletor de Tipo e Filtros */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl shadow-xl">
                <div className="flex p-1 bg-black/40 rounded-2xl w-fit">
                    <button
                        onClick={() => setTab('couriers')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${tab === 'couriers' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-zinc-500 hover:text-white'
                            }`}
                    >
                        <Truck size={14} /> Entregadores
                    </button>
                    <button
                        onClick={() => setTab('sellers')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${tab === 'sellers' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-zinc-500 hover:text-white'
                            }`}
                    >
                        <Store size={14} /> Vendedores
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-black/40 p-1 rounded-xl border border-zinc-800">
                        {(['pending', 'approved', 'rejected'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === f
                                    ? f === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                        : f === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : 'text-zinc-600 hover:text-zinc-400'
                                    }`}
                            >
                                {f === 'pending' ? 'Pendentes' : f === 'approved' ? 'Aprovados' : 'Rejeitados'}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition-all active:scale-90"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Busca */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-primary-500 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder={`Pesquisar por nome, email ou ${tab === 'couriers' ? 'veículo' : 'loja'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl pl-12 pr-4 py-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary-500/50 transition-all font-medium"
                />
            </div>

            {/* Conteúdo Central */}
            {loading && filteredPartners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                    <div className="relative">
                        <Loader2 size={48} className="text-primary-500 animate-spin" />
                        <div className="absolute inset-0 blur-2xl bg-primary-500/20 animate-pulse"></div>
                    </div>
                    <p className="text-zinc-500 font-black uppercase text-xs tracking-[0.2em]">Consultando Cadastros...</p>
                </div>
            ) : filteredPartners.length === 0 ? (
                <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-[3rem] border-dashed">
                    <div className="w-24 h-24 bg-zinc-800/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        {tab === 'couriers' ? <Truck size={40} className="text-zinc-700" /> : <Store size={40} className="text-zinc-700" />}
                    </div>
                    <h3 className="text-white font-bold text-lg">Nada por aqui</h3>
                    <p className="text-zinc-600 text-sm mt-1 max-w-xs mx-auto">Não encontramos {tab === 'couriers' ? 'entregadores' : 'vendedores'} com o status selecionado ou filtro aplicado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPartners.map(p => (
                        <div key={p.id} className="group bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 hover:border-primary-500/30 transition-all hover:shadow-2xl hover:shadow-primary-500/5 relative overflow-hidden">
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-all"></div>

                            <div className="flex items-start justify-between mb-6 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-[1.25rem] flex items-center justify-center border border-zinc-700/50 shadow-inner group-hover:scale-110 transition-transform">
                                        <User size={24} className="text-zinc-400 group-hover:text-primary-400 transition-colors" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-white text-lg tracking-tight group-hover:text-primary-400 transition-colors">{p.name}</h4>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{p.email}</p>
                                    </div>
                                </div>
                                {p.score !== undefined && (
                                    <div className="bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
                                        <ShieldCheck size={12} className="text-primary-400" />
                                        <span className="text-[10px] font-black text-primary-400 uppercase tracking-tighter">{p.score}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 mb-8 relative z-10">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-black/20 p-3 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-1">Contato</p>
                                        <p className="text-[11px] text-zinc-300 font-medium flex items-center gap-1.5">
                                            <Phone size={10} className="text-primary-500" /> {p.phone || 'N/D'}
                                        </p>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-1">Localização</p>
                                        <p className="text-[11px] text-zinc-300 font-medium flex items-center gap-1.5 truncate">
                                            <MapPin size={10} className="text-rose-500" /> {p.city || 'N/D'}
                                        </p>
                                    </div>
                                </div>

                                {tab === 'couriers' ? (
                                    <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10">
                                        <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em] mb-2">Veículo de Entrega</p>
                                        <div className="flex items-center gap-2 text-sm font-bold text-blue-300">
                                            {p.vehicle ? vehicleLabels[p.vehicle] || p.vehicle : 'Não Informado'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                                        <p className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.2em] mb-2">Nome Comercial</p>
                                        <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                                            <Store size={14} /> {p.companyName || 'Pessoa Física'}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-[10px] text-zinc-700 font-bold px-1">
                                    <span>CPF: {p.cpf || '***.***.***-**'}</span>
                                    <span>Cadastrado em {new Date(p.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {filter === 'pending' ? (
                                <div className="grid grid-cols-2 gap-3 relative z-10">
                                    <button
                                        onClick={() => handleApprove(tab === 'couriers' ? 'courier' : 'seller', p.id)}
                                        disabled={actionLoading === p.id}
                                        className="flex items-center justify-center gap-2 py-4 bg-primary-500 hover:bg-primary-400 text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 active:scale-95 shadow-xl shadow-primary-500/10"
                                    >
                                        {actionLoading === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                        Ativar
                                    </button>
                                    <button
                                        onClick={() => handleReject(tab === 'couriers' ? 'courier' : 'seller', p.id)}
                                        disabled={actionLoading === p.id}
                                        className="flex items-center justify-center gap-2 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 active:scale-95 border border-zinc-700/50"
                                    >
                                        <XCircle size={14} /> Rejeitar
                                    </button>
                                </div>
                            ) : (
                                <div className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] relative z-10 border ${filter === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                    {filter === 'approved' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    Status: {filter === 'approved' ? 'Aprovado' : 'Rejeitado'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
