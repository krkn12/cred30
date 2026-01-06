import { useState, FormEvent } from 'react';
import { X, ShieldCheck, QrCode, Phone, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface CompleteProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    currentUser: {
        cpf?: string | null;
        pixKey?: string | null;
        phone?: string | null;
    };
}

export const CompleteProfileModal = ({ isOpen, onClose, onComplete, currentUser }: CompleteProfileModalProps) => {
    const [cpf, setCpf] = useState(currentUser.cpf || '');
    const [pixKey, setPixKey] = useState(currentUser.pixKey || '');
    const [phone, setPhone] = useState(currentUser.phone || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatCPF = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
        if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    };

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 2) return `(${digits}`;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validações
        const cpfDigits = cpf.replace(/\D/g, '');
        const phoneDigits = phone.replace(/\D/g, '');

        if (cpfDigits.length !== 11) {
            setError('CPF deve ter 11 dígitos');
            return;
        }

        if (!pixKey || pixKey.length < 5) {
            setError('Informe uma chave PIX válida');
            return;
        }

        if (phoneDigits.length < 10) {
            setError('Telefone deve ter pelo menos 10 dígitos');
            return;
        }

        setLoading(true);

        try {
            const res = await apiService.post('/users/complete-profile', {
                cpf: cpfDigits,
                pixKey,
                phone: phoneDigits
            }) as any;

            if (res.success) {
                onComplete();
            } else {
                setError(res.message || 'Erro ao atualizar perfil');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar perfil');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Verificar quais campos já estão preenchidos
    const hasCpf = !!currentUser.cpf;
    const hasPix = !!currentUser.pixKey;
    const hasPhone = !!currentUser.phone;
    const isComplete = hasCpf && hasPix && hasPhone;

    if (isComplete) {
        onComplete();
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
            <div className="glass-strong w-full max-w-md rounded-[2rem] p-6 relative animate-in zoom-in-95">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={32} className="text-primary-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Complete seu Perfil</h2>
                    <p className="text-sm text-zinc-400">
                        Para realizar operações financeiras, precisamos de alguns dados adicionais.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
                        <AlertCircle size={18} className="text-red-500 shrink-0" />
                        <p className="text-sm text-red-500">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* CPF */}
                    {!hasCpf && (
                        <div className="relative group">
                            <CreditCard className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="CPF"
                                value={formatCPF(cpf)}
                                onChange={e => setCpf(e.target.value)}
                                className="w-full glass border-white/10 rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition-all"
                                required
                            />
                        </div>
                    )}

                    {/* Chave PIX */}
                    {!hasPix && (
                        <div className="relative group">
                            <QrCode className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Chave PIX (CPF, Email, Telefone ou Aleatória)"
                                value={pixKey}
                                onChange={e => setPixKey(e.target.value)}
                                className="w-full glass border-white/10 rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition-all"
                                required
                            />
                        </div>
                    )}

                    {/* Telefone */}
                    {!hasPhone && (
                        <div className="relative group">
                            <Phone className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                            <input
                                type="tel"
                                placeholder="Telefone / WhatsApp"
                                value={formatPhone(phone)}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full glass border-white/10 rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition-all"
                                required
                            />
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    Verificar Perfil
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
                        Seus dados são protegidos e usados apenas para operações financeiras dentro da plataforma.
                    </p>
                </form>
            </div>
        </div>
    );
};
