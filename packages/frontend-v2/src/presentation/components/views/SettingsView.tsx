import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Copy, Lock, ChevronRight, LogOut, Trash2, X as XIcon, ShieldCheck, QrCode, AlertCircle, Check, Bug, FileText, Phone, Store, Truck, RefreshCw } from 'lucide-react';
import { User } from '../../../domain/types/common.types';
import { ConfirmModal } from '../ui/ConfirmModal';
import { get2FASetup, verify2FA } from '../../../application/services/storage.service';
import { apiService } from '../../../application/services/api.service';

export const SettingsView = ({ user, onLogout, onDeleteAccount, onChangePassword, onRefresh }: {
    user: User,
    onLogout: () => void,
    onDeleteAccount: (code?: string) => void,
    onChangePassword: (oldPass: string, newPass: string) => Promise<void>,
    onRefresh?: () => void
}) => {
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteCode, setDeleteCode] = useState('');
    const [error, setError] = useState('');

    // Verificar se usuário tem senha (para usuários Google = não tem)
    const hasPassword = !!user.passwordHash;

    // CPF State
    const [showCpfModal, setShowCpfModal] = useState(false);
    const [cpfInput, setCpfInput] = useState('');
    const [cpfError, setCpfError] = useState('');
    const [cpfSuccess, setCpfSuccess] = useState('');
    const [savingCpf, setSavingCpf] = useState(false);

    // Phone State
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [phoneSuccess, setPhoneSuccess] = useState('');
    const [savingPhone, setSavingPhone] = useState(false);

    // 2FA Setup
    const [show2FASetup, setShow2FASetup] = useState(false);
    const [twoFactorData, setTwoFactorData] = useState<{ secret: string, qrCode: string, otpUri: string } | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [panicPhrase, setPanicPhrase] = useState('');
    const [secretPhrase, setSecretPhrase] = useState('');
    const [safeContactPhone, setSafeContactPhone] = useState('');
    const [isSavingSecurity, setIsSavingSecurity] = useState(false);
    const [securityPassword, setSecurityPassword] = useState('');
    const [showSecurityConfirm, setShowSecurityConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState<'SECURITY' | 'PIX' | null>(null);

    // PIX State
    const [showPixModal, setShowPixModal] = useState(false);
    const [pixInput, setPixInput] = useState('');
    const [pixError, setPixError] = useState('');

    // Efeito para carregar dados do usuário quando montado ou atualizado
    useEffect(() => {
        if (user.safeContactPhone) setSafeContactPhone(user.safeContactPhone);
    }, [user.safeContactPhone]);

    // Format CPF: 000.000.000-00
    const formatCpf = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
        if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    };

    // Format Phone: (00) 00000-0000
    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const handleSaveCpf = async () => {
        setCpfError('');
        const cleanCpf = cpfInput.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            setCpfError('CPF deve ter 11 dígitos');
            return;
        }
        setSavingCpf(true);
        try {
            const res = await apiService.updateCpf(cleanCpf);
            if (res.success) {
                setCpfSuccess('CPF salvo com sucesso!');
                setTimeout(() => {
                    setShowCpfModal(false);
                    setCpfSuccess('');
                    if (onRefresh) onRefresh();
                }, 1500);
            }
        } catch (err: any) {
            setCpfError(err.message || 'Erro ao salvar CPF');
        } finally {
            setSavingCpf(false);
        }
    };

    const handleSavePhone = async () => {
        setPhoneError('');
        const cleanPhone = phoneInput.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            setPhoneError('Telefone deve ter pelo menos 10 dígitos (com DDD)');
            return;
        }
        setSavingPhone(true);
        try {
            const res = await apiService.updatePhone(cleanPhone);
            if (res.success) {
                setPhoneSuccess('Telefone salvo com sucesso!');
                setTimeout(() => {
                    setShowPhoneModal(false);
                    setPhoneSuccess('');
                    if (onRefresh) onRefresh();
                }, 1500);
            }
        } catch (err: any) {
            setPhoneError(err.message || 'Erro ao salvar telefone');
        } finally {
            setSavingPhone(false);
        }
    };

    const handle2FASetup = async () => {
        try {
            const response = await get2FASetup();
            if (response.success && response.data) {
                setTwoFactorData(response.data);
                setShow2FASetup(true);
            } else {
                setError(response.message || 'Erro ao carregar dados 2FA');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados 2FA');
        }
    };

    const handleVerify2FA = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            const res = await verify2FA(user.email, verifyCode);
            if (res.success) {
                setSuccessMessage('2FA ativado com sucesso!');
                setTimeout(() => {
                    setShow2FASetup(false);
                    setSuccessMessage('');
                    if (onRefresh) onRefresh();
                    else window.location.reload();
                }, 1500);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao verificar código');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (newPassword.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres');
            return;
        }

        setIsSubmitting(true);
        try {
            // Para usuários Google (sem senha), oldPassword pode ser qualquer valor
            await onChangePassword(hasPassword ? oldPassword : 'google-user', newPassword);
            setShowChangePassword(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message || 'Erro ao alterar senha');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInitiatePixUpdate = () => {
        setPixError('');
        if (!pixInput || pixInput.length < 5) {
            setPixError('Chave PIX muito curta');
            return;
        }

        // Se usuário tem senha ou 2FA, pedimos confirmação
        if (hasPassword || user.two_factor_enabled) {
            setPendingAction('PIX');
            setShowSecurityConfirm(true);
        } else {
            // Se usuário Google sem 2FA, salva direto (o backend permite)
            performPixUpdate();
        }
    };

    const performPixUpdate = async () => {
        setIsSavingSecurity(true);
        try {
            const res = await apiService.updatePixKey(pixInput);
            if (res.success) {
                setSuccessMessage('Chave PIX atualizada! Saques bloqueados por 48h.');
                setShowPixModal(false);
                setTimeout(() => {
                    setSuccessMessage('');
                    if (onRefresh) onRefresh();
                }, 2000);
            } else {
                setPixError(res.message || 'Erro ao salvar chave PIX');
            }
        } catch (err: any) {
            setPixError(err.message || 'Erro ao salvar chave PIX');
        } finally {
            setIsSavingSecurity(false);
        }
    };

    const handleSaveSecuritySettings = async () => {
        if (!securityPassword && !user.two_factor_enabled && hasPassword) {
            setError('Senha necessária para confirmar alterações');
            return;
        }

        setIsSavingSecurity(true);
        setError('');

        try {
            const payload: any = {
                password: securityPassword,
                confirmationCode: user.two_factor_enabled ? verifyCode : undefined
            };

            if (pendingAction === 'PIX') {
                payload.pixKey = pixInput;
            } else {
                // SECURITY update
                payload.panicPhrase = panicPhrase;
                payload.secretPhrase = secretPhrase;
                payload.safeContactPhone = safeContactPhone;
            }

            const res = await apiService.updateUserProfile(payload);

            if (res.success) {
                setSuccessMessage(pendingAction === 'PIX' ? 'Chave PIX atualizada! Saques bloqueados por 48h.' : 'Configurações atualizadas!');
                setShowSecurityConfirm(false);
                setShowPixModal(false);
                setSecurityPassword('');
                setVerifyCode('');
                setPanicPhrase('');
                setSecretPhrase('');
                setPendingAction(null);

                setTimeout(() => {
                    setSuccessMessage('');
                    if (onRefresh) onRefresh();
                }, 2000);
            } else {
                setError(res.message || 'Erro ao salvar configurações');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar configurações');
        } finally {
            setIsSavingSecurity(false);
        }
    };

    const navigate = useNavigate();
    const isLocked = user.securityLockUntil ? user.securityLockUntil > Date.now() : false;
    const lockTimeRemaining = user.securityLockUntil ? Math.ceil((user.securityLockUntil - Date.now()) / (1000 * 60 * 60)) : 0;

    return (
        <div className="space-y-6 max-w-xl mx-auto pb-32">
            {/* Alerta de Segurança */}
            {isLocked && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-red-500 font-bold text-sm">Modo de Segurança Ativo</h3>
                        <p className="text-zinc-400 text-[10px] mt-1 leading-relaxed">
                            Sua conta está em modo "Apenas Visualização" por mais <strong>{lockTimeRemaining} horas</strong> devido a uma alteração recente de segurança.
                            Transações, resgates e apoios serão liberados após este período por sua proteção.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Perfil</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-500">Nome</label>
                        <p className="text-white border-b border-surfaceHighlight pb-2">{user.name}</p>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Email</label>
                        <p className="text-white border-b border-surfaceHighlight pb-2">{user.email}</p>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Chave PIX</label>
                        <div className="flex items-center justify-between border-b border-surfaceHighlight pb-2">
                            <p className="text-white">{user.pixKey || 'Não cadastrada'}</p>
                            <button
                                onClick={() => { setPixInput(user.pixKey || ''); setShowPixModal(true); }}
                                className="text-xs text-primary-400 hover:text-primary-300 font-bold"
                            >
                                {user.pixKey ? 'Editar' : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Telefone / WhatsApp</label>
                        <div className="flex items-center justify-between border-b border-surfaceHighlight pb-2">
                            {user.phone ? (
                                <p className="text-white font-medium">{formatPhone(user.phone)}</p>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={14} className="text-yellow-500" />
                                    <p className="text-yellow-500 text-sm">Não cadastrado</p>
                                </div>
                            )}
                            <button
                                onClick={() => { setPhoneInput(user.phone || ''); setShowPhoneModal(true); }}
                                className="text-xs text-primary-400 hover:text-primary-300 font-bold"
                            >
                                {user.phone ? 'Editar' : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">CPF</label>
                        <div className="flex items-center justify-between border-b border-surfaceHighlight pb-2">
                            {user.cpf ? (
                                <p className="text-white font-mono">{formatCpf(user.cpf)}</p>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={14} className="text-yellow-500" />
                                    <p className="text-yellow-500 text-sm">Não cadastrado</p>
                                </div>
                            )}
                            <button
                                onClick={() => { setCpfInput(user.cpf || ''); setShowCpfModal(true); }}
                                className="text-xs text-primary-400 hover:text-primary-300 font-bold"
                            >
                                {user.cpf ? 'Editar' : 'Adicionar'}
                            </button>
                        </div>
                        {!user.cpf && (
                            <p className="text-xs text-yellow-500/70 mt-1 italic">
                                ⚠️ CPF obrigatório para realizar resgates
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Score de Confiança</label>
                        <div className="flex items-center gap-2 border-b border-surfaceHighlight pb-2">
                            <Star size={16} className="text-primary-400" fill="currentColor" />
                            <p className="text-white font-bold">{user.score || 0}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceHighlight text-zinc-400">
                                {(user.score || 0) > 700 ? 'Excelente' : (user.score || 0) > 400 ? 'Bom' : 'Regular'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Código de Indicação</label>
                        <div className="flex items-center gap-2">
                            <p className="text-primary-400 font-bold text-xl">{user.referralCode}</p>
                            <button title="Copiar" className="text-zinc-500 hover:text-white" onClick={() => {
                                navigator.clipboard.writeText(user.referralCode);
                            }}><Copy size={16} /></button>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Compartilhe e ganhe R$ 5,00 por amigo.</p>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-4">Segurança</h3>
                <div className="space-y-3">
                    <button
                        onClick={() => setShowChangePassword(true)}
                        className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group"
                    >
                        <span className="flex items-center gap-3">
                            <Lock size={18} className="text-zinc-400 group-hover:text-primary-400 transition-colors" />
                            Alterar Senha
                        </span>
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                    </button>

                    <button
                        onClick={handle2FASetup}
                        className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group"
                    >
                        <span className="flex items-center gap-3">
                            <ShieldCheck size={18} className={`${user.two_factor_enabled ? 'text-emerald-400' : 'text-zinc-400'} group-hover:text-primary-400 transition-colors`} />
                            Autenticação 2FA
                        </span>
                        <div className="flex items-center gap-2">
                            {!user.two_factor_enabled ? (
                                <span className="text-[10px] bg-primary-500 text-black px-2 py-1 rounded-full font-extrabold animate-pulse">
                                    ATIVAR AGORA
                                </span>
                            ) : (
                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Ativo</span>
                            )}
                            <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                        </div>
                    </button>

                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 text-zinc-500 mb-1">
                            <ShieldCheck size={16} />
                            <h4 className="text-[10px] font-black uppercase tracking-widest">Protocolos de Recuperação</h4>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 block">Frase Secreta (Backup)</label>
                                <input
                                    type="text"
                                    placeholder="Uma frase que só você sabe"
                                    value={secretPhrase}
                                    onChange={e => setSecretPhrase(e.target.value)}
                                    className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:border-primary-500/50 outline-none transition"
                                />
                                <p className="text-[9px] text-zinc-600 mt-1 italic">
                                    Usada para recuperação manual de conta se perder o acesso total.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 block">Frase de Pânico (Emergência)</label>
                                <input
                                    type="password"
                                    placeholder="••••••"
                                    value={panicPhrase}
                                    onChange={e => setPanicPhrase(e.target.value)}
                                    className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:border-primary-500/50 outline-none transition"
                                />
                                <p className="text-[9px] text-zinc-600 mt-1 italic">
                                    Gatilho de segurança para casos de coação ou perda total de acesso.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 block">Canal Secundário de Verificação</label>
                                <input
                                    type="tel"
                                    placeholder="(00) 00000-0000"
                                    value={formatPhone(safeContactPhone)}
                                    onChange={e => setSafeContactPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                    className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:border-primary-500/50 outline-none transition"
                                />
                                <p className="text-[9px] text-zinc-600 mt-1">
                                    Número de backup para recebimento de alertas de segurança.
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    setPendingAction('SECURITY');
                                    setShowSecurityConfirm(true);
                                }}
                                disabled={isSavingSecurity}
                                className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold py-3 rounded-xl transition-all border border-white/5"
                            >
                                {isSavingSecurity ? 'Atualizando...' : 'Atualizar Protocolos'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-4">Oportunidades de Ganhos</h3>
                <div className="space-y-3">
                    <button onClick={() => navigate('/app/seller-registration')} className="w-full bg-gradient-to-r from-emerald-500/10 to-primary-500/10 hover:from-emerald-500/20 hover:to-primary-500/20 text-white border border-emerald-500/20 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <Store size={18} className="text-emerald-400 group-hover:text-primary-400 transition-colors" />
                            Tornar-se Lojista Verificado
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-emerald-500 text-black px-2 py-1 rounded-full font-extrabold">
                                TAXA 12%
                            </span>
                            <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                        </div>
                    </button>

                    <button onClick={() => navigate('/app/courier-registration')} className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 text-white border border-blue-500/20 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <Truck size={18} className="text-blue-400 group-hover:text-purple-400 transition-colors" />
                            Tornar-se Entregador Parceiro
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-blue-500 text-black px-2 py-1 rounded-full font-extrabold">
                                GANHE 90%
                            </span>
                            <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                        </div>
                    </button>
                </div>
            </div>

            <div className="pt-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-4">Ajuda e Suporte</h3>
                <div className="space-y-3">
                    <button onClick={() => window.dispatchEvent(new CustomEvent('open-bug-report'))} className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <Bug size={18} className="text-zinc-400 group-hover:text-red-400 transition-colors" />
                            Reportar Problema Técnico
                        </span>
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                    </button>

                    <button onClick={() => navigate('/app/my-bug-reports')} className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <FileText size={18} className="text-zinc-400 group-hover:text-primary-400 transition-colors" />
                            Meus Chamados e Relatórios
                        </span>
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                    </button>
                </div>
            </div>

            <div className="pt-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-4">Sistema</h3>
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400">
                                <Bug size={20} />
                            </div>
                            <div>
                                <p className="text-white text-xs font-bold">Build do App</p>
                                <p className="text-[10px] text-zinc-500 font-mono">v1.0.434 (Master)</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                if (confirm('Isso irá recarregar o App e limpar o cache técnico para garantir que você tenha a última versão. Deseja continuar?')) {
                                    if ('serviceWorker' in navigator) {
                                        navigator.serviceWorker.getRegistrations().then(registrations => {
                                            for (const registration of registrations) {
                                                registration.unregister();
                                            }
                                            window.location.reload();
                                        });
                                    } else {
                                        window.location.reload();
                                    }
                                }
                            }}
                            className="bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-primary-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <RefreshCw size={12} /> REFORÇAR
                        </button>
                    </div>
                    <p className="text-[9px] text-zinc-600 italic leading-relaxed">
                        Se o App não estiver refletindo as últimas mudanças, clique em REFORÇAR para forçar o carregamento do servidor.
                    </p>
                </div>
            </div>

            <div className="pt-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-4">Gerenciamento</h3>
                <div className="space-y-3">
                    <button onClick={onLogout} className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <LogOut size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                            Sair do Aplicativo
                        </span>
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                    </button>

                    <button onClick={() => setShowConfirmDelete(true)} className="w-full bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 border border-red-500/10 hover:border-red-500/30 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <Trash2 size={18} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                            Encerrar Conta Permanentemente
                        </span>
                        <ChevronRight size={16} className="opacity-20 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => { setShowConfirmDelete(false); setDeleteCode(''); }}
                onConfirm={() => onDeleteAccount(deleteCode)}
                title="Encerrar Conta"
                message="Tem certeza? Essa ação não pode ser desfeita e todos os seus dados serão anonimizados."
                confirmText="Sim, Encerrar Conta"
                type="danger"
            >
                {user.two_factor_enabled ? (
                    <div className="mb-6 animate-in slide-in-from-top-2">
                        <label className="text-xs text-zinc-500 mb-2 block font-bold uppercase tracking-widest">Código 2FA para Confirmar</label>
                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-3 text-zinc-500" size={18} />
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000 000"
                                value={deleteCode}
                                onChange={e => setDeleteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-red-500 outline-none transition text-lg tracking-[0.3em] font-mono"
                                autoFocus
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2">Por segurança, insira o código do seu autenticador.</p>
                    </div>
                ) : hasPassword && (
                    <div className="mb-6 animate-in slide-in-from-top-2">
                        <label className="text-xs text-zinc-500 mb-2 block font-bold uppercase tracking-widest">Sua Senha para Confirmar</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-zinc-500" size={18} />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={deleteCode}
                                onChange={e => setDeleteCode(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-red-500 outline-none transition"
                                autoFocus
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2">Confirme sua senha para validar esta ação definitiva.</p>
                    </div>
                )}
            </ConfirmModal>

            {/* Change Password Modal */}
            {showChangePassword && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowChangePassword(false); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in shadow-2xl">
                        <button title="Fechar" onClick={() => setShowChangePassword(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-4">
                            {hasPassword ? 'Alterar Senha' : 'Criar Senha'}
                        </h3>
                        {!hasPassword && (
                            <p className="text-zinc-400 text-sm mb-4">
                                Você logou com Google. Crie uma senha para acessar recursos de segurança.
                            </p>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            {hasPassword && (
                                <div>
                                    <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Senha Atual</label>
                                    <input
                                        type="password"
                                        required
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Nova Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl mt-2 transition"
                            >
                                {isSubmitting ? 'Salvando...' : hasPassword ? 'Alterar Senha' : 'Criar Senha'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* 2FA Setup Modal - Bottom Sheet on Mobile */}
            {show2FASetup && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[110] p-0 sm:p-4 animate-in fade-in duration-300" onClick={() => setShow2FASetup(false)}>
                    <div className="bg-[#0A0A0A] border-t sm:border border-zinc-800 rounded-t-[2rem] sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-md relative shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300" onClick={(e) => e.stopPropagation()}>
                        {/* Drag Handle for Mobile */}
                        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden opacity-50" />
                        <button onClick={() => setShow2FASetup(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10"><XIcon size={24} /></button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={32} className="text-primary-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Segurança 2FA</h3>
                            <p className="text-zinc-400 text-sm">Escaneie o QR Code abaixo no seu app de autenticação.</p>
                        </div>

                        {twoFactorData?.qrCode && (
                            <div className="space-y-4 mb-6">
                                <div className="bg-white p-3 rounded-2xl mx-auto w-fit shadow-lg">
                                    <img src={twoFactorData.qrCode} alt="2FA QR Code" className="w-40 h-40" />
                                </div>
                                {twoFactorData?.otpUri && (
                                    <a
                                        href={twoFactorData.otpUri}
                                        className="w-full bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all group"
                                    >
                                        <QrCode size={16} className="group-hover:rotate-12 transition-transform" />
                                        Configurar no Navegador
                                    </a>
                                )}
                            </div>
                        )}

                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-6 space-y-4">
                            <div className="flex justify-between items-start border-b border-white/5 pb-3">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Emissor</p>
                                    <p className="text-white font-medium">Cred30</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Conta</p>
                                    <p className="text-white font-medium truncate max-w-[120px]">{user.email}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Chave Secreta</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 font-mono text-primary-400 text-sm font-bold tracking-wider overflow-x-auto whitespace-nowrap hide-scrollbar">
                                        {twoFactorData?.secret}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(twoFactorData?.secret || '');
                                            setSuccessMessage('Copiado!');
                                            setTimeout(() => setSuccessMessage(''), 2000);
                                        }}
                                        className="h-10 w-10 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-xl flex items-center justify-center transition-all active:scale-90"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && <div className="mb-4 text-red-500 text-center text-xs">{error}</div>}
                        {successMessage && <div className="mb-4 text-emerald-500 text-center text-xs font-bold animate-pulse">{successMessage}</div>}

                        <form onSubmit={handleVerify2FA} className="space-y-4">
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000000"
                                value={verifyCode}
                                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 text-center text-white text-3xl tracking-[0.3em] font-mono focus:border-primary-500 outline-none"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition shadow-lg shadow-primary-500/20"
                            >
                                {isSubmitting ? 'Verificando...' : 'Ativar 2FA Agora'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* CPF Edit Modal */}
            {showCpfModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowCpfModal(false); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in shadow-2xl">
                        <button title="Fechar" onClick={() => setShowCpfModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-2">{user.cpf ? 'Editar CPF' : 'Adicionar CPF'}</h3>
                        <p className="text-zinc-400 text-sm mb-6">Seu CPF é necessário para realizar saques via PIX.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">CPF</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="000.000.000-00"
                                    value={formatCpf(cpfInput)}
                                    onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white text-lg font-mono tracking-wider focus:border-primary-500 outline-none transition"
                                />
                            </div>

                            {cpfError && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {cpfError}
                                </div>
                            )}

                            {cpfSuccess && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg flex items-center gap-2">
                                    <Check size={14} />
                                    {cpfSuccess}
                                </div>
                            )}

                            <button
                                onClick={handleSaveCpf}
                                disabled={savingCpf || cpfInput.length !== 11}
                                className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition"
                            >
                                {savingCpf ? 'Salvando...' : 'Salvar CPF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIX Edit Modal */}
            {showPixModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowPixModal(false); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in shadow-2xl">
                        <button title="Fechar" onClick={() => setShowPixModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-2">{user.pixKey ? 'Editar PIX' : 'Adicionar PIX'}</h3>
                        <p className="text-zinc-400 text-sm mb-6">Chave PIX (E-mail, CPF, Tel ou Aleatória) para recebimento.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Chave PIX</label>
                                <input
                                    type="text"
                                    placeholder="Informe sua chave PIX"
                                    value={pixInput}
                                    onChange={(e) => setPixInput(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white text-lg font-medium focus:border-primary-500 outline-none transition"
                                />
                            </div>

                            {pixError && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {pixError}
                                </div>
                            )}

                            <button
                                onClick={handleInitiatePixUpdate}
                                disabled={!pixInput || pixInput.length < 5 || isSavingSecurity}
                                className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition"
                            >
                                {isSavingSecurity ? 'Salvando...' : 'Salvar Chave PIX'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-8 pb-12 text-center opacity-30">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Versão 2.5.0 • Cred30</p>
            </div>

            {/* Security Confirmation Modal */}
            <ConfirmModal
                isOpen={showSecurityConfirm}
                onClose={() => { setShowSecurityConfirm(false); setPendingAction(null); }}
                onConfirm={handleSaveSecuritySettings}
                title={pendingAction === 'PIX' ? "Confirmar Nova Chave PIX" : "Confirmar Alteração Sensível"}
                message={
                    pendingAction === 'PIX'
                        ? `Confirme para definir a chave PIX: ${pixInput}. Isso aplicará o bloqueio de segurança de 48h para saques.`
                        : "Para alterar seus protocolos de segurança, precisamos confirmar sua identidade."
                }
                confirmText={pendingAction === 'PIX' ? "Confirmar e Salvar PIX" : "Confirmar Alterações"}
                type="danger"
            >
                <div className="space-y-4 mb-4">
                    {user.two_factor_enabled ? (
                        <div>
                            <label className="text-xs text-zinc-500 mb-1.5 block">Código 2FA</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="000 000"
                                value={verifyCode}
                                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white text-center text-2xl font-mono tracking-widest focus:border-primary-500 outline-none"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs text-zinc-500 mb-1.5 block">Senha da Conta</label>
                            <input
                                type="password"
                                placeholder="••••••"
                                value={securityPassword}
                                onChange={e => setSecurityPassword(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none"
                            />
                        </div>
                    )}
                    {error && <p className="text-red-500 text-[10px] font-bold text-center">{error}</p>}
                </div>
            </ConfirmModal>

            {/* Phone Edit Modal */}
            {showPhoneModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowPhoneModal(false); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in shadow-2xl">
                        <button title="Fechar" onClick={() => setShowPhoneModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-2">{user.phone ? 'Editar Telefone' : 'Adicionar Telefone'}</h3>
                        <p className="text-zinc-400 text-sm mb-6">Seu WhatsApp é importante para o contato direto da administração.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Telefone / WhatsApp</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        placeholder="(00) 00000-0000"
                                        value={formatPhone(phoneInput)}
                                        onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-4 text-white text-lg font-medium focus:border-primary-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            {phoneError && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {phoneError}
                                </div>
                            )}

                            {phoneSuccess && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg flex items-center gap-2">
                                    <Check size={14} />
                                    {phoneSuccess}
                                </div>
                            )}

                            <button
                                onClick={handleSavePhone}
                                disabled={savingPhone || phoneInput.length < 10}
                                className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition"
                            >
                                {savingPhone ? 'Salvando...' : 'Salvar Telefone'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
