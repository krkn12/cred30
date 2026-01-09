import { useState, useEffect, useCallback } from 'react';
import { X, Bell, CheckCircle, AlertTriangle, Info, DollarSign, Package, Truck } from 'lucide-react';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'payment' | 'order' | 'delivery';
    title: string;
    message: string;
    duration?: number;
}

interface ToastItemProps {
    toast: Toast;
    onDismiss: (id: string) => void;
}

const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, toast.duration || 5000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-emerald-400" />;
            case 'error':
                return <AlertTriangle className="w-5 h-5 text-red-400" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-amber-400" />;
            case 'payment':
                return <DollarSign className="w-5 h-5 text-emerald-400" />;
            case 'order':
                return <Package className="w-5 h-5 text-primary-400" />;
            case 'delivery':
                return <Truck className="w-5 h-5 text-blue-400" />;
            default:
                return <Info className="w-5 h-5 text-blue-400" />;
        }
    };

    const getBorderColor = () => {
        switch (toast.type) {
            case 'success':
            case 'payment':
                return 'border-emerald-500/30';
            case 'error':
                return 'border-red-500/30';
            case 'warning':
                return 'border-amber-500/30';
            case 'order':
                return 'border-primary-500/30';
            case 'delivery':
                return 'border-blue-500/30';
            default:
                return 'border-blue-500/30';
        }
    };

    return (
        <div
            className={`
        relative flex items-start gap-3 p-4 
        bg-zinc-900/95 backdrop-blur-xl 
        border ${getBorderColor()} 
        rounded-2xl shadow-2xl shadow-black/50
        animate-in slide-in-from-right-5 fade-in duration-300
        max-w-sm w-full
      `}
        >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
                {getIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{toast.title}</p>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{toast.message}</p>
            </div>

            {/* Close button */}
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 p-1 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
                <X className="w-4 h-4" />
            </button>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800 rounded-b-2xl overflow-hidden">
                <div
                    className="h-full bg-primary-500 animate-shrink"
                    style={{
                        animationDuration: `${toast.duration || 5000}ms`,
                    }}
                />
            </div>
        </div>
    );
};

// Toast Container Component
export const ToastContainer = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { ...toast, id }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Listener global para notificações
    useEffect(() => {
        const handleNotification = (event: CustomEvent<any>) => {
            const notification = event.detail;
            addToast({
                type: notification.type || 'info',
                title: notification.title || 'Notificação',
                message: notification.message || '',
                duration: notification.duration || 5000,
            });
        };

        window.addEventListener('show-toast' as any, handleNotification);
        return () => window.removeEventListener('show-toast' as any, handleNotification);
    }, [addToast]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-auto">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
            ))}
        </div>
    );
};

// Helper function to show toast from anywhere
export const showToast = (toast: Omit<Toast, 'id'>) => {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: toast }));
};

// Specific helper functions
export const showSuccessToast = (title: string, message: string) => {
    showToast({ type: 'success', title, message });
};

export const showErrorToast = (title: string, message: string) => {
    showToast({ type: 'error', title, message });
};

export const showPaymentToast = (title: string, message: string) => {
    showToast({ type: 'payment', title, message, duration: 8000 });
};

export const showDeliveryToast = (title: string, message: string) => {
    showToast({ type: 'delivery', title, message, duration: 8000 });
};
