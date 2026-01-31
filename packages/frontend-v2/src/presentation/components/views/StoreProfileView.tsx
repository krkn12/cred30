import { useState, useEffect } from 'react';
import {
    Clock,
    Save,
    ArrowLeft,
    Store,
    Tag,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface StoreProfileViewProps {
    onBack: () => void;
    onSuccess: (title: string, msg: string) => void;
}

const DAYS = [
    { id: 'monday', label: 'Segunda-feira' },
    { id: 'tuesday', label: 'Terça-feira' },
    { id: 'wednesday', label: 'Quarta-feira' },
    { id: 'thursday', label: 'Quinta-feira' },
    { id: 'friday', label: 'Sexta-feira' },
    { id: 'saturday', label: 'Sábado' },
    { id: 'sunday', label: 'Domingo' },
];

export const StoreProfileView = ({ onBack, onSuccess }: StoreProfileViewProps) => {
    const [merchantName, setMerchantName] = useState('');
    const [category, setCategory] = useState('');
    const [openingHours, setOpeningHours] = useState<any>({});
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Carregar categorias
                const catsRes = await apiService.marketplace.getFoodCategories();
                if (catsRes.success) setCategories(catsRes.data);

                // Carregar status do vendedor (que agora inclui dados de delivery)
                const statusRes = await apiService.marketplace.getSellerStatus();
                if (statusRes) {
                    setMerchantName(statusRes.merchantName || statusRes.companyName || '');
                    setCategory(statusRes.restaurantCategory || '');
                    setOpeningHours(statusRes.openingHours || {});
                }
            } catch (err) {
                console.error('Erro ao carregar perfil:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const res = await apiService.marketplace.updateStoreProfile({
                merchantName,
                category,
                openingHours
            });
            if (res.success) {
                onSuccess('Parabéns!', 'Perfil da sua loja atualizado com sucesso.');
                onBack();
            } else {
                setError(res.message);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar perfil');
        } finally {
            setIsSaving(false);
        }
    };

    const updateDay = (dayId: string, field: 'open' | 'close', value: string) => {
        setOpeningHours((prev: any) => ({
            ...prev,
            [dayId]: {
                ...(prev[dayId] || { open: '08:00', close: '22:00' }),
                [field]: value
            }
        }));
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500">
            <Loader2 className="animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Carregando Configurações...</p>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-3 text-zinc-400 hover:text-white transition-all bg-zinc-900 rounded-[1.2rem] shadow-lg border border-zinc-800 active:scale-90">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">MEU PERFIL DELIVERY</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Personalize sua loja para os clientes</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-[2rem] mb-6 flex items-center gap-4 animate-in shake duration-300">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                        <AlertCircle className="text-red-500" size={20} />
                    </div>
                    <p className="text-red-400 text-xs font-bold leading-relaxed">{error}</p>
                </div>
            )}

            <div className="space-y-6">
                {/* Dados da Loja */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-7 space-y-7 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-primary-500/20 rounded-lg flex items-center justify-center">
                            <Store className="text-primary-400" size={18} />
                        </div>
                        <h3 className="text-white font-black text-xs uppercase tracking-widest">Identidade Visual</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 px-1">Nome de Exibição (Como os clientes verão)</label>
                            <input
                                type="text"
                                value={merchantName}
                                onChange={(e) => setMerchantName(e.target.value)}
                                placeholder="Ex: Pizzaria Forno de Ouro"
                                className="w-full bg-black/60 border border-zinc-800 rounded-2xl py-4 px-5 text-white focus:border-primary-500 outline-none transition-all font-bold text-sm shadow-inner"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 px-1">Categoria do Cardápio</label>
                            <div className="relative">
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full bg-black/60 border border-zinc-800 rounded-2xl py-4 px-5 text-white focus:border-primary-500 outline-none transition-all font-bold text-sm appearance-none shadow-inner"
                                >
                                    <option value="" className="text-zinc-600">Selecione o tipo de comida...</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.name} className="bg-zinc-900">{c.name}</option>
                                    ))}
                                </select>
                                <Tag className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Horários */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-7 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-6 px-1">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Clock className="text-blue-400" size={18} />
                        </div>
                        <h3 className="text-white font-black text-xs uppercase tracking-widest">Agenda de Funcionamento</h3>
                    </div>

                    <div className="space-y-3">
                        {DAYS.map(day => (
                            <div key={day.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-zinc-800/30 hover:border-zinc-700 transition-colors">
                                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest w-32">{day.label}</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="time"
                                        value={openingHours[day.id]?.open || '08:00'}
                                        onChange={(e) => updateDay(day.id, 'open', e.target.value)}
                                        className="bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-1.5 text-[10px] font-black text-white outline-none focus:border-primary-500 shadow-sm"
                                    />
                                    <span className="text-zinc-700 text-[8px] font-black uppercase">Até</span>
                                    <input
                                        type="time"
                                        value={openingHours[day.id]?.close || '22:00'}
                                        onChange={(e) => updateDay(day.id, 'close', e.target.value)}
                                        className="bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-1.5 text-[10px] font-black text-white outline-none focus:border-primary-500 shadow-sm"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sticky bottom-6 left-0 right-0 pt-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-gradient-to-r from-primary-600 to-primary-400 hover:from-primary-500 hover:to-primary-300 text-black font-black py-5 rounded-[2.5rem] text-sm uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-primary-500/30 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        Salvar Configurações
                    </button>
                    <p className="text-center text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-4">
                        As alterações são aplicadas instantaneamente no app
                    </p>
                </div>
            </div>
        </div>
    );
};
