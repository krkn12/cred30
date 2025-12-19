import React, { useState } from 'react';
import { X as XIcon, MessageSquare } from 'lucide-react';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    message: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    placeholder = 'Digite aqui...',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar'
}) => {
    const [value, setValue] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative shadow-2xl animate-in zoom-in duration-300">
                <button title="Fechar" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={20} /></button>

                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 text-primary-400 bg-zinc-800/50">
                    <MessageSquare size={24} />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">{message}</p>

                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-black/40 border border-zinc-800 focus:border-primary-500 rounded-xl py-3 px-4 text-white outline-none transition mb-6"
                    autoFocus
                />

                <div className="space-y-2">
                    <button
                        onClick={() => { onConfirm(value); setValue(''); onClose(); }}
                        className="w-full font-bold py-3 rounded-xl transition shadow-lg bg-primary-500 hover:bg-primary-400 text-black"
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-3 text-zinc-500 hover:text-white text-sm font-medium transition"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};
