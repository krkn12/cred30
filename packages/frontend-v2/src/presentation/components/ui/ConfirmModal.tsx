import React from 'react';
import { AlertTriangle, X as XIcon } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    children?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'info',
    children
}) => {
    if (!isOpen) return null;

    const accentColor = type === 'danger' ? 'bg-red-500 hover:bg-red-400 text-white' :
        type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-400 text-black' :
            'bg-primary-500 hover:bg-primary-400 text-black';

    const iconColor = type === 'danger' ? 'text-red-400' :
        type === 'warning' ? 'text-yellow-400' :
            'text-primary-400';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[500] p-0 sm:p-4 animate-in fade-in duration-300"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-sm relative shadow-2xl shadow-black animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300">
                {/* Mobile Handle */}
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                <button
                    title="Fechar"
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 hover:bg-zinc-800 p-2 rounded-full hidden sm:block"
                >
                    <XIcon size={18} />
                </button>

                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/50 ${type === 'danger' ? 'bg-red-500/10 text-red-500' : type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary-500/10 text-primary-500'} ring-1 ring-inset ${type === 'danger' ? 'ring-red-500/20' : type === 'warning' ? 'ring-yellow-500/20' : 'ring-primary-500/20'} mx-auto sm:mx-0`}>
                    <AlertTriangle size={32} strokeWidth={2.5} />
                </div>

                <div className="text-center sm:text-left">
                    <h3 className="text-2xl font-black text-white mb-2 tracking-tight leading-tight">{title}</h3>
                    <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-8">{message}</p>
                </div>

                {children}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`w-full font-black text-sm uppercase tracking-widest py-5 rounded-2xl transition-all shadow-xl active:scale-[0.98] ${accentColor}`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-4 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-[0.2em] transition-colors"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};
