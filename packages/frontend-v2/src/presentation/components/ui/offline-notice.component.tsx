import React from 'react';
import { WifiOff, AlertCircle } from 'lucide-react';

interface OfflineNoticeProps {
    isOnline: boolean;
}

export const OfflineNotice: React.FC<OfflineNoticeProps> = ({ isOnline }) => {
    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[10000] animate-in slide-in-from-top-full duration-300">
            <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-bold shadow-lg">
                <WifiOff size={16} />
                <span>Você está offline. Algumas funcionalidades podem estar limitadas.</span>
                <AlertCircle size={14} className="ml-2 opacity-50" />
            </div>
        </div>
    );
};
