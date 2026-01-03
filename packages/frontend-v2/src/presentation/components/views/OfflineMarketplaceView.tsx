import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { CheckCircle2, QrCode, ScanLine, XCircle, UploadCloud, WifiOff } from 'lucide-react';

interface OfflineMarketplaceViewProps {
    user: any;
    pendingSales: any[];
    onSaveSale: (sale: any) => void;
    onSync: () => void;
}

export const OfflineMarketplaceView = ({ user, pendingSales, onSaveSale, onSync }: OfflineMarketplaceViewProps) => {
    const [mode, setMode] = useState<'MENU' | 'SELL_CREATE' | 'SELL_SCAN_RECEIPT' | 'BUY_SCAN' | 'BUY_SHOW_RECEIPT'>('MENU');
    const [amount, setAmount] = useState('');
    const [itemTitle, setItemTitle] = useState('');
    const [generatedOffer, setGeneratedOffer] = useState<any>(null);
    const [scannedOffer, setScannedOffer] = useState<any>(null);
    const [generatedReceipt, setGeneratedReceipt] = useState<any>(null);
    const [error, setError] = useState('');

    const handleCreateOffer = () => {
        if (!amount || !itemTitle) return;
        const offer = {
            type: 'SALE_OFFER',
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            sellerId: user.id, // Assuming user has id
            sellerName: user.name, // Assuming user has name
            amount: parseFloat(amount),
            itemTitle,
            timestamp: Date.now()
        };
        setGeneratedOffer(offer);
        setMode('SELL_SCAN_RECEIPT'); // Show QR and Button to Scan Receipt
    };

    const handleScan = (data: string | null) => {
        if (!data) return;
        try {
            const parsed = JSON.parse(data);

            // Lógica do Vendedor: Escaneando Recibo do Comprador
            if (mode === 'SELL_SCAN_RECEIPT') {
                if (parsed.type === 'PAYMENT_RECEIPT') {
                    if (parsed.originalOfferId !== generatedOffer.id) {
                        setError('Recibo não corresponde à venda atual.');
                        return;
                    }
                    // Sucesso!
                    onSaveSale({
                        ...generatedOffer,
                        buyerId: parsed.buyerId,
                        buyerName: parsed.buyerName,
                        receiptSignature: parsed.signature,
                        status: 'PENDING_SYNC'
                    });
                    setMode('MENU');
                    setAmount('');
                    setItemTitle('');
                    setGeneratedOffer(null);
                    alert('Venda registrada! Lembre-se de sincronizar quando tiver internet.');
                }
            }
            // Lógica do Comprador: Escaneando Oferta do Vendedor
            else if (mode === 'BUY_SCAN') {
                if (parsed.type === 'SALE_OFFER') {
                    setScannedOffer(parsed);
                    // Vai para confirmação
                }
            }
        } catch (e) {
            console.error(e);
            setError('Código inválido.');
        }
    };

    const handleConfirmPayment = () => {
        if (!scannedOffer) return;
        const receipt = {
            type: 'PAYMENT_RECEIPT',
            originalOfferId: scannedOffer.id,
            buyerId: user.id,
            buyerName: user.name,
            amount: scannedOffer.amount,
            timestamp: Date.now(),
            signature: `SIG_${Math.random().toString(36)}_${user.id}` // Mock signature
        };
        setGeneratedReceipt(receipt);
        setMode('BUY_SHOW_RECEIPT');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center">
                <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <WifiOff className="text-primary-400" size={24} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Modo Offline (Interior)</h3>
                <p className="text-xs text-zinc-400 mt-2 max-w-xs mx-auto">
                    Realize trocas mesmo sem internet. Sincronize quando retomar o sinal.
                </p>

                {/* Sync Status */}
                {pendingSales.length > 0 && mode === 'MENU' && (
                    <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <p className="text-amber-400 text-xs font-bold mb-2">
                            {pendingSales.length} venda(s) pendente(s) de envio.
                        </p>
                        <button
                            onClick={onSync}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-lg transition uppercase flex items-center justify-center gap-2"
                        >
                            <UploadCloud size={14} />
                            Sincronizar Agora
                        </button>
                    </div>
                )}
            </div>

            {/* ERROR MSG */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-500 text-xs font-bold text-center flex items-center justify-center gap-2">
                    <XCircle size={14} /> {error}
                    <button onClick={() => setError('')} className="ml-2 underline">OK</button>
                </div>
            )}

            {/* MAIN MENU */}
            {mode === 'MENU' && (
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => setMode('SELL_CREATE')}
                        className="p-6 bg-zinc-900 border border-zinc-700 hover:border-primary-500 rounded-2xl flex flex-col items-center gap-3 transition group"
                    >
                        <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center group-hover:bg-primary-500 group-hover:text-black transition">
                            <QrCode size={24} />
                        </div>
                        <span className="font-bold text-white text-sm">VENDER</span>
                        <span className="text-[10px] text-zinc-500">Gerar Cobrança</span>
                    </button>

                    <button
                        onClick={() => setMode('BUY_SCAN')}
                        className="p-6 bg-zinc-900 border border-zinc-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center gap-3 transition group"
                    >
                        <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition">
                            <ScanLine size={24} />
                        </div>
                        <span className="font-bold text-white text-sm">PAGAR</span>
                        <span className="text-[10px] text-zinc-500">Ler Cobrança</span>
                    </button>
                </div>
            )}

            {/* VENDEDOR: CRIAR OFERTA */}
            {mode === 'SELL_CREATE' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase">O que você está vendendo?</label>
                        <input
                            type="text"
                            value={itemTitle}
                            onChange={(e) => setItemTitle(e.target.value)}
                            placeholder="Ex: Bolo de Pote"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase">Valor (R$)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition"
                        />
                    </div>
                    <button
                        onClick={handleCreateOffer}
                        className="w-full py-3 bg-primary-500 text-black font-black rounded-xl uppercase hover:bg-primary-400 transition mb-2"
                    >
                        Gerar QR de Cobrança
                    </button>
                    <button onClick={() => setMode('MENU')} className="w-full py-3 text-zinc-500 text-xs font-bold uppercase">Cancelar</button>
                </div>
            )}

            {/* VENDEDOR: MOSTRAR QR E ESPERAR RECIBO */}
            {mode === 'SELL_SCAN_RECEIPT' && generatedOffer && (
                <div className="text-center space-y-6">
                    <div className="bg-white p-4 rounded-2xl inline-block mx-auto">
                        <QRCodeSVG value={JSON.stringify(generatedOffer)} size={200} />
                    </div>
                    <p className="text-sm text-zinc-300 font-medium">
                        Peça para o cliente escanear este código.<br />
                        Após ele confirmar, clique abaixo para ler o comprovante dele.
                    </p>

                    {/* Scanner Toggle (Fake Toggle logic for simplicity, just show scanner) */}
                    <div className="border-t border-zinc-800 pt-4">
                        <p className="text-xs text-zinc-500 mb-2 font-bold uppercase">Cliente já pagou?</p>
                        <div className="h-64 bg-black rounded-2xl overflow-hidden relative border border-zinc-700">
                            <Scanner onScan={(result) => result[0] && handleScan(result[0].rawValue)} />
                            <div className="absolute inset-0 border-2 border-primary-500/50 pointer-events-none rounded-2xl animate-pulse"></div>
                            <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white bg-black/50 py-1">Aponte para o QR do Cliente</div>
                        </div>
                    </div>

                    <button onClick={() => setMode('MENU')} className="w-full py-3 text-zinc-500 text-xs font-bold uppercase">Cancelar Venda</button>
                </div>
            )}

            {/* COMPRADOR: LER OFERTA */}
            {mode === 'BUY_SCAN' && !scannedOffer && (
                <div className="space-y-4 text-center">
                    <p className="text-sm text-zinc-300">Aponte para o QR Code do Vendedor</p>
                    <div className="h-64 bg-black rounded-2xl overflow-hidden relative border border-zinc-700 mx-auto">
                        <Scanner onScan={(result) => result[0] && handleScan(result[0].rawValue)} />
                        <div className="absolute inset-0 border-2 border-primary-500/50 pointer-events-none rounded-2xl animate-pulse"></div>
                    </div>
                    <button onClick={() => setMode('MENU')} className="w-full py-3 text-zinc-500 text-xs font-bold uppercase">Cancelar</button>
                </div>
            )}

            {/* COMPRADOR: CONFIRMAR E MOSTRAR RECIBO */}
            {mode === 'BUY_SCAN' && scannedOffer && (
                <div className="space-y-6 text-center animate-in zoom-in duration-300">
                    <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700">
                        <p className="text-xs text-zinc-400 uppercase font-bold mb-1">Confirmar Pagamento</p>
                        <h2 className="text-3xl font-black text-white mb-2">R$ {scannedOffer.amount.toFixed(2)}</h2>
                        <p className="text-lg text-primary-400 font-bold mb-4">{scannedOffer.itemTitle}</p>
                        <p className="text-xs text-zinc-500">Vendedor: {scannedOffer.sellerName}</p>
                    </div>

                    <p className="text-xs text-red-400 max-w-xs mx-auto">
                        Ao confirmar, você gera um compromisso de pagamento que será debitado quando houver conexão.
                    </p>

                    <button
                        onClick={handleConfirmPayment}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl uppercase transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={18} />
                        Assinar e Pagar
                    </button>
                    <button onClick={() => { setScannedOffer(null); }} className="w-full py-3 text-zinc-500 text-xs font-bold uppercase">Cancelar</button>
                </div>
            )}

            {/* COMPRADOR: MOSTRAR RECIBO FINAL */}
            {mode === 'BUY_SHOW_RECEIPT' && generatedReceipt && (
                <div className="text-center space-y-6">
                    <div className="bg-white p-4 rounded-2xl inline-block mx-auto border-4 border-emerald-500">
                        <QRCodeSVG value={JSON.stringify(generatedReceipt)} size={200} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase text-emerald-500 mb-2">Comprovante Gerado!</h3>
                        <p className="text-sm text-zinc-300 font-medium">
                            Mostre este código para o vendedor<br />para liberar o produto.
                        </p>
                    </div>
                    <button onClick={() => { setMode('MENU'); setScannedOffer(null); setGeneratedReceipt(null); }} className="w-full py-3 bg-zinc-800 text-white text-xs font-bold rounded-xl uppercase">
                        Concluir
                    </button>
                </div>
            )}
        </div>
    );
};
