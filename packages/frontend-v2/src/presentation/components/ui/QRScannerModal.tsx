import React from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { X as XIcon, Scan, ShieldCheck } from 'lucide-react';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
    isOpen,
    onClose,
    onScan
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-300">
            <div className="bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] p-6 w-full max-w-sm relative shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-500/10 p-2 rounded-xl text-primary-500 ring-1 ring-primary-500/20">
                            <Scan size={20} />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-xs uppercase tracking-[0.15em]">Validar Entrega</h3>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Aponte para o QR Code do Comprador</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white p-2 rounded-full transition-all outline-none"
                    >
                        <XIcon size={18} />
                    </button>
                </div>

                {/* Scanner Viewport */}
                <div className="aspect-square relative rounded-3xl overflow-hidden border-2 border-primary-500/30 bg-zinc-950 group">
                    <Scanner
                        onScan={(result) => {
                            if (result[0]?.rawValue) {
                                onScan(result[0].rawValue);
                                onClose();
                            }
                        }}
                        onError={(error: any) => console.log(error?.message)}
                        constraints={{
                            facingMode: 'environment'
                        }}
                    />

                    {/* Scanner Overlay UI */}
                    <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                        <div className="w-full h-full border-2 border-primary-500 animate-pulse relative">
                            {/* Corners */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 -ml-1 -mt-1 rounded-tl-xl shadow-[0_0_15px_rgba(var(--primary-500-rgb),0.5)]"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 -mr-1 -mt-1 rounded-tr-xl shadow-[0_0_15px_rgba(var(--primary-500-rgb),0.5)]"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 -ml-1 -mb-1 rounded-bl-xl shadow-[0_0_15px_rgba(var(--primary-500-rgb),0.5)]"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 -mr-1 -mb-1 rounded-br-xl shadow-[0_0_15px_rgba(var(--primary-500-rgb),0.5)]"></div>

                            {/* Scanning Line */}
                            <div className="absolute left-0 right-0 h-0.5 bg-primary-500/50 shadow-[0_0_15px_rgba(var(--primary-500-rgb),0.5)] top-1/2 -translate-y-1/2"></div>
                        </div>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="mt-8 flex items-center gap-4 bg-primary-500/5 border border-primary-500/10 p-4 rounded-2xl">
                    <ShieldCheck size={24} className="text-primary-500 shrink-0" />
                    <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                        Sistema de <span className="text-primary-400 font-bold">Segurança Handshake</span>. O saldo só será liberado após a confirmação visual e digital do recebimento.
                    </p>
                </div>

                {/* Manual Input Hint */}
                <button
                    onClick={onClose}
                    className="w-full mt-6 py-4 text-zinc-600 hover:text-zinc-300 text-[9px] font-black uppercase tracking-[0.2em] transition-colors"
                >
                    Voltar para entrada manual
                </button>
            </div>
        </div>
    );
};
