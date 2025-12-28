import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, KeyRound, Lock, QrCode, Repeat, ArrowLeft, Mail, ShieldCheck, XCircle, ChevronRight, Check, Copy } from 'lucide-react';
import { loginUser, registerUser, resetPassword, verify2FA, apiService } from '../../../application/services/storage.service';
import { TermsAcceptanceModal } from '../ui/TermsAcceptanceModal';
import { User } from '../../../domain/types/common.types';

export const AuthScreen = ({ onLogin }: { onLogin: (u: User) => void }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [isForgot, setIsForgot] = useState(false);
    const [isRecover2FA, setIsRecover2FA] = useState(false); // Recuperar autenticador perdido

    // Verification Modal State
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
    const [verifyCode, setVerifyCode] = useState('');

    // Form States
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [secretPhrase, setSecretPhrase] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // 2FA Setup State
    const [twoFactorData, setTwoFactorData] = useState<{ secret: string, qrCode: string, otpUri: string } | null>(null);
    const [is2FASetup, setIs2FASetup] = useState(false);
    const [requires2FA, setRequires2FA] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState('');

    // Error/Success States for Custom Alerts
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showTerms, setShowTerms] = useState(false);
    const [pendingUser, setPendingUser] = useState<User | null>(null);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Capturar código de indicação da URL se existir
    React.useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) {
            setReferralCode(ref.toUpperCase());
            setIsRegister(true); // Se tem link de indicação, provavelmente quer cadastrar
        }
    }, [searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (isForgot) {
            try {
                await resetPassword(email, secretPhrase, newPassword);
                setSuccess('Senha redefinida com sucesso! Faça login.');
                setTimeout(() => {
                    setIsForgot(false);
                    setNewPassword('');
                    setSuccess(null);
                }, 2000);
            } catch (error: any) {
                setError(error.message);
            }
            return;
        }

        if (isRegister) {
            // Validar campos básicos antes de mostrar os termos
            if (!name || !email || !password || !pixKey || !secretPhrase) {
                setError("Por favor, preencha todos os campos obrigatórios.");
                return;
            }
            setShowTerms(true);
            return;
        }

        try {
            const res = await loginUser(email, password, secretPhrase, twoFactorCode);

            if (res.requires2FA) {
                setRequires2FA(true);
                setError(null);
                setSuccess('Código 2FA necessário');
                return;
            }

            onLogin(res);
        } catch (error: any) {
            // Se o backend indicar que o email não está verificado
            if (error.requiresVerification) {
                setVerifyEmailAddr(error.email || email);
                setShowVerifyModal(true);
                setError(error.message);
            } else {
                setError(error.message);
            }
        }
    };

    // Função para recuperar 2FA usando email + senha + frase secreta
    const handleRecover2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!email || !password || !secretPhrase) {
            setError('Preencha email, senha e frase secreta.');
            return;
        }

        try {
            const res = await apiService.recover2FA(email, password, secretPhrase);
            if (res.success && res.data?.twoFactor) {
                setTwoFactorData(res.data.twoFactor);
                setVerifyEmailAddr(email);
                setIs2FASetup(true);
                setShowVerifyModal(true);
                setSuccess('2FA recuperado! Configure novamente seu autenticador.');
            } else {
                setError(res.message || 'Erro ao recuperar 2FA');
            }
        } catch (error: any) {
            setError(error.message || 'Erro ao recuperar 2FA');
        }
    };

    const handleConfirmRegistration = async () => {
        setShowTerms(false);
        setError(null);
        try {
            const res = await registerUser(name, email, password, pixKey, secretPhrase, referralCode, cpf);
            if (res.twoFactor) {
                setTwoFactorData(res.twoFactor);
                setVerifyEmailAddr(email);
                setPendingUser(res.user);
                setIs2FASetup(true);
                setShowVerifyModal(true);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };


    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await verify2FA(verifyEmailAddr, verifyCode);
            if (res.success) {
                setSuccess('Conta ativada com sucesso! Entrando...');
                setTimeout(() => {
                    setShowVerifyModal(false);
                    if (pendingUser) {
                        onLogin(pendingUser);
                    } else {
                        setIsRegister(false);
                        setIs2FASetup(false);
                    }
                    setSuccess(null);
                }, 1500);
            } else {
                setError(res.message);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-background">
            {/* Desktop Side Image */}
            <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop"
                        alt="Background"
                        className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transpose to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
                </div>

                <div className="relative z-10 p-12 max-w-lg text-center">
                    <div className="w-24 h-24 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-primary-500/20 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
                        <img src="/pwa-192x192.png" alt="Cred30 Logo" className="w-16 h-16 drop-shadow-2xl" />
                    </div>
                    <h1 className="text-5xl font-black text-white mb-6 tracking-tight">
                        Cred<span className="text-primary-400">30</span>
                    </h1>
                    <p className="text-xl text-zinc-400 font-medium leading-relaxed">
                        A revolução do microcrédito associativo.
                        <br />
                        <span className="text-primary-400">Sem juros abusivos. Sem bancos.</span>
                    </p>
                </div>
            </div>

            {/* Form Side */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 md:p-12 relative overflow-y-auto">
                <div className="w-full max-w-md space-y-8">
                    {/* Header Mobile Only */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-500/20">
                            <img src="/pwa-192x192.png" alt="Cred30 Logo" className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black text-white">Cred<span className="text-primary-400">30</span></h2>
                    </div>

                    <div className="bg-surface border border-surfaceHighlight p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary-400 to-primary-600"></div>

                        {/* Custom Error Alert */}
                        {error && (
                            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <XCircle size={20} className="shrink-0" />
                                <p className="text-sm font-medium flex-1 leading-tight">{error}</p>
                                <button onClick={() => setError(null)} className="hover:text-white"><XCircle size={16} /></button>
                            </div>
                        )}

                        {/* Custom Success Alert */}
                        {success && (
                            <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <Check size={20} className="shrink-0" />
                                <p className="text-sm font-medium">{success}</p>
                            </div>
                        )}

                        <form onSubmit={handleLogin} method="POST" className="space-y-4">
                            {isForgot ? (
                                <>
                                    <div className="text-center mb-6">
                                        <h2 className="text-white text-xl font-bold">Recuperar Senha</h2>
                                        <p className="text-zinc-500 text-xs mt-1">Insira seus dados para redefinir o acesso</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <Users className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                                            <input
                                                type="email"
                                                name="email"
                                                placeholder="Email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                        <div className="relative group">
                                            <KeyRound className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                                            <input
                                                type="text"
                                                name="secretPhrase"
                                                placeholder="Frase Secreta"
                                                value={secretPhrase}
                                                onChange={e => setSecretPhrase(e.target.value)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                                            <input
                                                type="password"
                                                name="new-password"
                                                placeholder="Nova Senha"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-wider py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 mt-2">
                                        Redefinir Senha
                                    </button>
                                    <button type="button" onClick={() => setIsForgot(false)} className="w-full py-2 text-zinc-500 hover:text-white text-xs font-bold transition-colors">
                                        Voltar para Login
                                    </button>
                                </>
                            ) : isRecover2FA ? (
                                <>
                                    <div className="text-center mb-6">
                                        <ShieldCheck className="mx-auto text-primary-400 mb-4" size={48} />
                                        <h2 className="text-white text-xl font-bold">Recuperar Autenticador</h2>
                                        <p className="text-zinc-500 text-xs mt-2 px-4">
                                            Use suas credenciais mestre para gerar um novo segredo 2FA.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <Users className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                                            <input
                                                type="email"
                                                placeholder="Email Cadastrado"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                                            <input
                                                type="password"
                                                placeholder="Sua Senha"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                        <div className="relative group">
                                            <KeyRound className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                                            <input
                                                type="text"
                                                placeholder="Frase Secreta"
                                                value={secretPhrase}
                                                onChange={e => setSecretPhrase(e.target.value)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-white focus:border-primary-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleRecover2FA} className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-wider py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 mt-4">
                                        Recuperar Acesso
                                    </button>
                                    <button type="button" onClick={() => setIsRecover2FA(false)} className="w-full py-2 text-zinc-500 hover:text-white text-xs font-bold transition-colors">
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="text-center mb-8 hidden lg:block">
                                        <h2 className="text-2xl font-bold text-white mb-1">
                                            {isRegister ? 'Criar Conta' : 'Boas vindas'}
                                        </h2>
                                        <p className="text-zinc-500 text-sm">
                                            {isRegister ? 'Preencha os dados abaixo para começar.' : 'Entre para acessar sua carteira.'}
                                        </p>
                                    </div>

                                    {isRegister && (
                                        <div className="relative group animate-in slide-in-from-left-2 duration-300">
                                            <Users className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Nome Completo"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-sm text-white focus:border-primary-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-sm text-white focus:border-primary-500 outline-none transition"
                                            required
                                        />
                                    </div>

                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                                        <input
                                            type="password"
                                            placeholder="Senha"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-sm text-white focus:border-primary-500 outline-none transition"
                                            required
                                        />
                                    </div>

                                    <div className="relative group">
                                        <KeyRound className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                                        <input
                                            type="password"
                                            placeholder={isRegister ? "Crie sua Frase Secreta" : "Frase Secreta"}
                                            value={secretPhrase}
                                            onChange={e => setSecretPhrase(e.target.value)}
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-sm text-white focus:border-primary-500 outline-none transition"
                                            required
                                        />
                                    </div>

                                    {isRegister && (
                                        <>
                                            <div className="relative group animate-in slide-in-from-left-2 duration-300 delay-75">
                                                <ShieldCheck className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="CPF (apenas números)"
                                                    value={cpf}
                                                    onChange={e => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-sm text-white focus:border-primary-500 outline-none transition"
                                                    required
                                                />
                                            </div>

                                            <div className="relative group animate-in slide-in-from-left-2 duration-300 delay-100">
                                                <QrCode className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Chave Pix"
                                                    value={pixKey}
                                                    onChange={e => setPixKey(e.target.value)}
                                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-10 text-sm text-white focus:border-primary-500 outline-none transition"
                                                    required
                                                />
                                            </div>

                                            <div className="relative group animate-in slide-in-from-left-2 duration-300 delay-150">
                                                <Repeat className="absolute left-3 top-3.5 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Código de Indicação (Obrigatório)"
                                                    value={referralCode}
                                                    onChange={e => setReferralCode(e.target.value)}
                                                    className="w-full bg-background border border-primary-500/30 rounded-xl py-3.5 pl-10 text-sm text-white focus:border-primary-500 outline-none transition"
                                                    required
                                                />
                                            </div>
                                        </>
                                    )}

                                    {requires2FA && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 bg-primary-500/5 p-4 rounded-xl border border-primary-500/20">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="p-2 bg-primary-500/20 rounded-lg text-primary-400">
                                                    <ShieldCheck size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-sm">Autenticação 2FA</p>
                                                    <p className="text-[10px] text-zinc-400">Digite o código do seu app</p>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="000 000"
                                                inputMode="numeric"
                                                maxLength={6}
                                                value={twoFactorCode}
                                                onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                                                className="w-full bg-background/50 border border-primary-500/40 rounded-xl py-3 text-center text-white text-xl tracking-[0.5em] font-mono focus:border-primary-500 outline-none transition"
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98] mt-6"
                                    >
                                        {isRegister ? 'Criar Conta' : (requires2FA ? 'Confirmar' : 'Acessar')}
                                    </button>
                                </>
                            )}
                        </form>

                        {!isForgot && !isRecover2FA && (
                            <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                                <p className="text-zinc-400 text-xs text-center">
                                    {isRegister ? 'Já é membro?' : 'Ainda não é membro?'}
                                    <button
                                        onClick={() => setIsRegister(!isRegister)}
                                        className="ml-2 text-primary-400 hover:text-white font-bold transition-colors underline decoration-primary-500/30"
                                    >
                                        {isRegister ? 'Fazer Login' : 'Solicitar Convite'}
                                    </button>
                                </p>

                                {!isRegister && (
                                    <div className="flex justify-center gap-6">
                                        <button onClick={() => setIsForgot(true)} className="text-[10px] text-zinc-500 hover:text-zinc-300 font-medium">
                                            Esqueci a senha
                                        </button>
                                        <button onClick={() => setIsRecover2FA(true)} className="text-[10px] text-zinc-500 hover:text-zinc-300 font-medium">
                                            Perdi o 2FA
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <footer className="text-center">
                        <div className="flex justify-center gap-6 text-[10px] text-zinc-600 mb-2">
                            <a href="/terms" className="hover:text-zinc-400">Termos</a>
                            <a href="/privacy" className="hover:text-zinc-400">Privacidade</a>
                            <a href="/support" className="hover:text-zinc-400">Suporte</a>
                        </div>
                        <p className="text-[10px] text-zinc-700">© 2025 Cred30 Social Bank</p>
                    </footer>
                </div>
            </div>

            {/* Email Verification Modal - Mantido Global */}
            {showVerifyModal && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300 backdrop-blur-md">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 md:p-10 w-full max-w-md relative shadow-[0_0_80px_rgba(6,182,212,0.15)] max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setShowVerifyModal(false)} className="absolute top-4 right-4 md:top-6 md:right-6 text-zinc-500 hover:text-white transition-colors z-10" aria-label="Fechar modal">
                            <XCircle size={24} />
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-primary-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3 shadow-inner">
                                <ShieldCheck size={40} className="text-primary-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Configurar Autenticador</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Escaneie o QR Code abaixo com o <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
                            </p>
                        </div>

                        {twoFactorData?.qrCode && (
                            <div className="space-y-6 mb-8">
                                <div className="bg-white p-4 rounded-3xl mx-auto w-fit shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-transform hover:scale-105">
                                    <img src={twoFactorData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                                </div>

                                {twoFactorData?.otpUri && (
                                    <a
                                        href={twoFactorData.otpUri}
                                        className="w-full bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all group"
                                    >
                                        <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                                        Configurar no Navegador (Extensão)
                                    </a>
                                )}
                            </div>
                        )}

                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 mb-8 space-y-4">
                            <div className="flex justify-between items-start border-b border-white/5 pb-3">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Emissor</p>
                                    <p className="text-white font-medium">Cred30</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Conta</p>
                                    <p className="text-white font-medium truncate max-w-[120px]">{verifyEmailAddr}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Chave Secreta</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-primary-400 text-lg font-bold tracking-wider overflow-x-auto whitespace-nowrap hide-scrollbar">
                                        {twoFactorData?.secret}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(twoFactorData?.secret || '');
                                            setSuccess('Chave copiada!');
                                            setTimeout(() => setSuccess(null), 2000);
                                        }}
                                        className="h-12 w-12 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-xl flex items-center justify-center transition-all active:scale-90"
                                        title="Copiar Chave"
                                    >
                                        <Copy size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm flex items-center gap-3">
                                <XCircle size={18} />
                                <p className="leading-tight flex-1">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleVerifySubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Código de Confirmação</label>
                                <input
                                    type="text"
                                    name="verifyCode"
                                    placeholder="000000"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={verifyCode}
                                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-5 text-center text-white text-3xl tracking-[0.4em] font-mono focus:border-primary-500 outline-none transition shadow-inner"
                                    autoFocus
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-5 rounded-2xl transition-all shadow-[0_10px_30px_rgba(6,182,212,0.3)] flex items-center justify-center gap-3 text-lg mt-4 group"
                            >
                                <ShieldCheck size={22} className="group-hover:scale-110 transition-transform" />
                                Ativar 2FA e Entrar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <TermsAcceptanceModal
                isOpen={showTerms}
                onClose={() => setShowTerms(false)}
                onAccept={handleConfirmRegistration}
            />
        </div>
    );
};
