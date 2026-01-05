import { useState, useEffect } from 'react';
import { Store, Phone, MapPin, Building2, CheckCircle, AlertCircle, Loader2, ArrowLeft, BadgeCheck, Percent, Zap } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { useNavigate } from 'react-router-dom';

interface SellerStatus {
    isSeller: boolean;
    status: string | null;
    hasWallet: boolean;
    companyName: string | null;
}

export const SellerRegistrationView = () => {
    const navigate = useNavigate();
    const [sellerStatus, setSellerStatus] = useState<SellerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Formulário
    const [formData, setFormData] = useState({
        companyName: '',
        cpfCnpj: '',
        mobilePhone: '',
        address: '',
        addressNumber: '',
        neighborhood: '',
        city: '',
        state: '',
        postalCode: '',
        companyType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'MEI' | 'LIMITED'
    });

    useEffect(() => {
        fetchSellerStatus();
    }, []);

    const fetchSellerStatus = async () => {
        try {
            const response = await apiService.getSellerStatus();
            if (response) {
                setSellerStatus(response);
            }
        } catch (err) {
            console.error('Erro ao buscar status de vendedor:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSubmitting(true);

        try {
            const response = await apiService.registerSeller(formData);
            if (response.success) {
                setSuccess('Conta de vendedor criada com sucesso! Agora você pode receber pagamentos diretamente.');
                fetchSellerStatus();
            } else {
                setError(response.message || 'Erro ao registrar');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar registro');
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    // Já é vendedor
    if (sellerStatus?.isSeller && sellerStatus?.hasWallet) {
        return (
            <div className="max-w-lg mx-auto p-6">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-8 text-center">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Você é um Vendedor Verificado!</h1>
                    <p className="text-zinc-400 mb-4">
                        {sellerStatus.companyName && <span className="text-white font-medium">{sellerStatus.companyName}</span>}
                    </p>
                    <p className="text-sm text-emerald-400 mb-4">
                        Seus recebimentos são processados internamente com split automático no saldo Cred30.
                    </p>
                    <div className="bg-zinc-900 p-4 rounded-xl mb-6">
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Sua taxa</p>
                        <p className="text-3xl font-black text-emerald-400">12%</p>
                        <p className="text-zinc-500 text-xs">por venda (vs 27.5% sem verificação)</p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-6 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-8 rounded-xl transition-all"
                    >
                        Ir para o Marketplace
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 pb-24">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-4 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Voltar
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center">
                        <Store className="w-7 h-7 text-primary-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Tornar-se Vendedor Verificado</h1>
                        <p className="text-zinc-400 text-sm">Receba pagamentos direto na sua conta com taxa reduzida</p>
                    </div>
                </div>
            </div>

            {/* Alertas */}
            {error && (
                <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {success && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p className="text-sm text-emerald-400">{success}</p>
                </div>
            )}

            {/* Comparativo de Taxas */}
            <div className="mb-6 bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4 text-center">Comparativo de Taxas</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center">
                        <p className="text-red-400 text-xs font-bold uppercase mb-2">Não Verificado</p>
                        <p className="text-2xl font-black text-red-400">27.5%</p>
                        <p className="text-zinc-500 text-xs mt-1">por venda</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                        <div className="flex items-center justify-center gap-1 mb-2">
                            <BadgeCheck size={12} className="text-emerald-400" />
                            <p className="text-emerald-400 text-xs font-bold uppercase">Verificado</p>
                        </div>
                        <p className="text-2xl font-black text-emerald-400">12%</p>
                        <p className="text-zinc-500 text-xs mt-1">por venda</p>
                    </div>
                </div>

                <h3 className="text-white font-bold mb-3">Vantagens de ser Verificado:</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                    <li className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-emerald-500" />
                        Taxa reduzida de <span className="text-emerald-400 font-bold">12%</span> (economia de 15%)
                    </li>
                    <li className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-500" />
                        Recebimento automático via Split Payment
                    </li>
                    <li className="flex items-center gap-2">
                        <BadgeCheck className="w-4 h-4 text-emerald-500" />
                        Selo de Vendedor Verificado nos anúncios
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        Saque direto para sua conta bancária
                    </li>
                </ul>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nome da Empresa/Loja */}
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        Nome da Loja / Empresa
                    </label>
                    <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            value={formData.companyName}
                            onChange={(e) => updateField('companyName', e.target.value)}
                            placeholder="Ex: Loja do João"
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-primary-500 outline-none transition"
                            required
                        />
                    </div>
                </div>

                {/* Tipo de Conta e CPF/CNPJ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                            Tipo de Conta
                        </label>
                        <select
                            value={formData.companyType}
                            onChange={(e) => updateField('companyType', e.target.value)}
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl py-3.5 px-4 text-white focus:border-primary-500 outline-none transition"
                        >
                            <option value="INDIVIDUAL">Pessoa Física (CPF)</option>
                            <option value="MEI">MEI</option>
                            <option value="LIMITED">Empresa (CNPJ)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                            CPF ou CNPJ
                        </label>
                        <input
                            type="text"
                            value={formData.cpfCnpj}
                            onChange={(e) => updateField('cpfCnpj', e.target.value.replace(/\D/g, '').slice(0, 14))}
                            placeholder="Apenas números"
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl py-3.5 px-4 text-white focus:border-primary-500 outline-none transition"
                            required
                        />
                    </div>
                </div>

                {/* Telefone */}
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        Telefone Celular
                    </label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="tel"
                            value={formData.mobilePhone}
                            onChange={(e) => updateField('mobilePhone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="11999999999"
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-primary-500 outline-none transition"
                            required
                        />
                    </div>
                </div>

                {/* Endereço */}
                <div className="space-y-4">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        <MapPin className="inline mr-2" size={14} />
                        Endereço Comercial
                    </label>

                    <div className="grid grid-cols-3 gap-3">
                        <input
                            type="text"
                            value={formData.postalCode}
                            onChange={(e) => updateField('postalCode', e.target.value.replace(/\D/g, '').slice(0, 8))}
                            placeholder="CEP"
                            className="col-span-1 bg-zinc-900 border border-white/5 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition text-sm"
                            required
                        />
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => updateField('address', e.target.value)}
                            placeholder="Rua, Avenida..."
                            className="col-span-2 bg-zinc-900 border border-white/5 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition text-sm"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <input
                            type="text"
                            value={formData.addressNumber}
                            onChange={(e) => updateField('addressNumber', e.target.value)}
                            placeholder="Nº"
                            className="bg-zinc-900 border border-white/5 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition text-sm"
                        />
                        <input
                            type="text"
                            value={formData.neighborhood}
                            onChange={(e) => updateField('neighborhood', e.target.value)}
                            placeholder="Bairro"
                            className="col-span-2 bg-zinc-900 border border-white/5 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition text-sm"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => updateField('city', e.target.value)}
                            placeholder="Cidade"
                            className="col-span-2 bg-zinc-900 border border-white/5 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition text-sm"
                            required
                        />
                        <input
                            type="text"
                            value={formData.state}
                            onChange={(e) => updateField('state', e.target.value.toUpperCase().slice(0, 2))}
                            placeholder="UF"
                            maxLength={2}
                            className="bg-zinc-900 border border-white/5 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition text-sm uppercase"
                            required
                        />
                    </div>
                </div>

                {/* Botão Submit */}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processando...
                        </>
                    ) : (
                        <>
                            <Store className="w-5 h-5" />
                            Criar Conta de Vendedor
                        </>
                    )}
                </button>

                <p className="text-xs text-zinc-500 text-center">
                    Ao criar sua conta, você concorda com os termos de uso do Asaas para subconta digital.
                </p>
            </form>
        </div>
    );
};

export default SellerRegistrationView;
