import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    loadingText?: string;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
    isLoading,
    loadingText,
    children,
    variant = 'primary',
    className = "",
    disabled,
    ...props
}) => {
    const variants = {
        primary: "bg-primary-500 hover:bg-primary-400 text-black shadow-lg shadow-primary-500/20",
        secondary: "bg-zinc-800 hover:bg-zinc-700 text-white",
        outline: "border border-white/10 hover:bg-white/5 text-white",
        danger: "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20",
        ghost: "hover:bg-white/5 text-zinc-400 hover:text-white"
    };

    const baseStyles = "relative flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading ? (
                <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{loadingText || "Processando..."}</span>
                </>
            ) : (
                children
            )}
        </button>
    );
};
