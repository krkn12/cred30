import { useState, useEffect } from 'react';
import { Truck, Phone, MapPin, CheckCircle, AlertCircle, Loader2, ArrowLeft, Bike, Car, Fingerprint, Map } from 'lucide-react';
import { Motorcycle } from '@phosphor-icons/react';
import { apiService } from '../../../application/services/api.service';
import { useNavigate } from 'react-router-dom';

interface CourierStatus {
    isCourier: boolean;
    status: string | null;
    vehicle: string | null;
}


const CourierRegistrationView = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<'loading' | 'form' | 'success' | 'already'>('loading');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [courierData, setCourierData] = useState<CourierStatus | null>(null);

    const [form, setForm] = useState({
        cpf: '',
        phone: '',
        city: '',
        state: '',
        vehicle: '',
        idPhoto: '',
        vehiclePhoto: '',
        docPhoto: ''
    });

    const vehicles = [
        { id: 'BIKE', label: 'Bicicleta', icon: Bike, emoji: '🚲', desc: 'Entregas leves e próximas' },
        { id: 'MOTO', label: 'Moto', icon: Motorcycle, emoji: '🛵', desc: 'Entregas rápidas na cidade' },
        { id: 'CAR', label: 'Carro', icon: Car, emoji: '🚗', desc: 'Entregas maiores e distantes' },
        { id: 'TRUCK', label: 'Utilitário', icon: Truck, emoji: '🚚', desc: 'Cargas grandes e mudanças' },
    ];

    const states = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

    useEffect(() => {
        fetchCourierStatus();
    }, []);

    const fetchCourierStatus = async () => {
        try {
            const res = await apiService.getCourierStatus();
            setCourierData(res);
            if (res.isCourier) {
                setStep('already');
            } else {
                setStep('form');
            }
        } catch (e) {
            setStep('form');
        }
    };

    const formatCpf = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
        if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    };

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'idPhoto' | 'vehiclePhoto' | 'docPhoto') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setError('A imagem deve ter no máximo 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setForm(prev => ({ ...prev, [field]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await apiService.registerCourier({
                cpf: form.cpf.replace(/\D/g, ''),
                phone: form.phone.replace(/\D/g, ''),
                city: form.city,
                state: form.state,
                vehicle: form.vehicle,
                idPhoto: form.idPhoto,
                vehiclePhoto: form.vehiclePhoto,
                docPhoto: form.docPhoto
            });

            if (res.success) {
                setStep('success');
            } else {
                setError(res.message || 'Erro ao registrar');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao registrar');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    if (step === 'already') {
        return (
            <div className="max-w-md mx-auto px-4 py-8 text-center">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Você já é Entregador!</h2>
                <p className="text-zinc-400 mb-6">
                    Seu veículo: <span className="text-primary-400 font-bold">{courierData?.vehicle}</span>
                </p>
                <button
                    onClick={() => navigate('/app/logistics')}
                    className="w-full bg-primary-500 text-black font-bold py-4 rounded-xl"
                >
                    Ver Entregas Disponíveis
                </button>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="max-w-md mx-auto px-4 py-8 text-center animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Cadastro Aprovado!</h2>
                <p className="text-zinc-400 mb-8">
                    Você já pode aceitar entregas compatíveis com seu veículo.
                </p>
                <button
                    onClick={() => navigate('/app/logistics')}
                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition-all"
                >
                    🚚 Ver Entregas Disponíveis
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto px-4 py-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition">
                    <ArrowLeft className="w-5 h-5 text-zinc-400" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white">Tornar-se Entregador</h1>
                    <p className="text-zinc-500 text-sm">Ganhe dinheiro fazendo entregas</p>
                </div>
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-br from-primary-500/10 to-emerald-500/10 border border-primary-500/20 rounded-2xl p-4 mb-6">
                <h3 className="text-sm font-bold text-white mb-3">✨ Benefícios do Entregador</h3>
                <ul className="space-y-2 text-xs text-zinc-400">
                    <li>✓ Ganhe até R$ 500/dia fazendo entregas</li>
                    <li>✓ Você escolhe quando e onde trabalhar</li>
                    <li>✓ Pagamento instantâneo após cada entrega</li>
                    <li>✓ Selo de verificação automático</li>
                </ul>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Veículo */}
                <div>
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-3 block">
                        Seu Veículo *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {vehicles.map(v => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => setForm({ ...form, vehicle: v.id })}
                                className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col items-center justify-center ${form.vehicle === v.id
                                    ? 'border-primary-500 bg-primary-500/10'
                                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 transition-all ${form.vehicle === v.id ? 'bg-primary-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                    <v.icon size={24} />
                                </div>
                                <p className="font-bold text-white text-xs">{v.label}</p>
                                <p className="text-[10px] text-zinc-500 text-center mt-1">{v.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* CPF */}
                <div>
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">CPF *</label>
                    <div className="relative">
                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                            value={formatCpf(form.cpf)}
                            onChange={e => setForm({ ...form, cpf: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:border-primary-500 outline-none"
                            required
                        />
                    </div>
                </div>

                {/* Telefone */}
                <div>
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">
                        Telefone *
                    </label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="(00) 00000-0000"
                            value={formatPhone(form.phone)}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:border-primary-500 outline-none"
                            required
                        />
                    </div>
                </div>

                {/* Cidade e Estado */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block"> Cidade *</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input
                                type="text"
                                placeholder="Sua cidade"
                                value={form.city}
                                onChange={e => setForm({ ...form, city: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:border-primary-500 outline-none"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">UF *</label>
                        <div className="relative">
                            <Map className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <select
                                value={form.state}
                                onChange={e => setForm({ ...form, state: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-3 text-white focus:border-primary-500 outline-none appearance-none"
                                required
                            >
                                <option value="">UF</option>
                                {states.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Documentação */}
                {form.vehicle && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2 block">
                            Documentação Obrigatória
                        </label>

                        <div className="grid grid-cols-1 gap-4">
                            {/* Foto RG ou CNH */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-1">{form.vehicle === 'BIKE' ? 'RG ou CNH (Frente)' : 'CNH (Frente)'}</p>
                                <p className="text-zinc-500 text-xs mb-3">Sua identificação oficial</p>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="input-id"
                                    onChange={(e) => handleFileChange(e, 'idPhoto')}
                                />
                                <label htmlFor="input-id" className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${form.idPhoto ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
                                    {form.idPhoto ? (
                                        <img src={form.idPhoto} className="w-full h-full object-cover rounded-lg" alt="ID" />
                                    ) : (
                                        <>
                                            <Fingerprint className="text-zinc-600 mb-2" size={24} />
                                            <span className="text-zinc-500 text-xs">Anexar Documento</span>
                                        </>
                                    )}
                                </label>
                            </div>

                            {/* Foto do Veículo */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-1">Foto da {form.vehicle === 'BIKE' ? 'Bicicleta' : form.vehicle === 'MOTO' ? 'Moto' : 'Veículo'}</p>
                                <p className="text-zinc-500 text-xs mb-3">Foto visível do veículo que será usado</p>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="input-vehicle"
                                    onChange={(e) => handleFileChange(e, 'vehiclePhoto')}
                                />
                                <label htmlFor="input-vehicle" className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${form.vehiclePhoto ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
                                    {form.vehiclePhoto ? (
                                        <img src={form.vehiclePhoto} className="w-full h-full object-cover rounded-lg" alt="Vehicle" />
                                    ) : (
                                        <>
                                            {form.vehicle === 'BIKE' ? <Bike className="text-zinc-600 mb-2" size={24} /> : form.vehicle === 'MOTO' ? <Motorcycle className="text-zinc-600 mb-2" size={24} /> : <Car className="text-zinc-600 mb-2" size={24} />}
                                            <span className="text-zinc-500 text-xs">Anexar Foto</span>
                                        </>
                                    )}
                                </label>
                            </div>

                            {/* CRLV ou Nota Fiscal */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-1">{form.vehicle === 'BIKE' ? 'Nota Fiscal ou Declaração' : 'Documento (CRLV)'}</p>
                                <p className="text-zinc-500 text-xs mb-3">{form.vehicle === 'BIKE' ? 'Comprovação de propriedade' : 'Documento do veículo atualizado'}</p>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="input-doc"
                                    onChange={(e) => handleFileChange(e, 'docPhoto')}
                                />
                                <label htmlFor="input-doc" className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${form.docPhoto ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
                                    {form.docPhoto ? (
                                        <img src={form.docPhoto} className="w-full h-full object-cover rounded-lg" alt="Doc" />
                                    ) : (
                                        <>
                                            <MapPin className="text-zinc-600 mb-2" size={24} />
                                            <span className="text-zinc-500 text-xs">Anexar Documento</span>
                                        </>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !form.vehicle || !form.cpf || !form.phone || !form.city || !form.state || !form.idPhoto || !form.vehiclePhoto || !form.docPhoto}
                    className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-6"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <Truck className="w-5 h-5" />
                            Cadastrar como Entregador
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default CourierRegistrationView;
