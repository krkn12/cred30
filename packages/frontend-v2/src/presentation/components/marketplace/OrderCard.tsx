import React from 'react';
import { Zap, Navigation2, Truck, Phone, Download, ExternalLink, Scan } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { QRScannerModal } from '../ui/QRScannerModal';
import { correctStoredAddress } from '../../../application/utils/location_corrections';

interface OrderCardProps {
    order: any;
    currentUser: any;
    apiService: any;
    onSuccess: (title: string, msg: string) => void;
    onError: (title: string, msg: string) => void;
    setConfirmData: (data: any) => void;
    fetchData: () => void;
    setTrackingOrder: (order: any) => void;
    formatCurrency: (value: number) => string;
}

export const OrderCard: React.FC<OrderCardProps> = ({
    order,
    currentUser,
    apiService,
    onSuccess,
    onError,
    setConfirmData,
    fetchData,
    setTrackingOrder,
    formatCurrency
}) => {
    const [isScannerOpen, setIsScannerOpen] = React.useState(false);

    const handleConfirm = async (code?: string) => {
        try {
            const res = await apiService.post(`/marketplace/order/${order.id}/receive`, { verificationCode: code?.toUpperCase() });
            if (res.success) {
                onSuccess('Entrega Validada!', 'O saldo foi liberado com sucesso.');
                fetchData();
            } else {
                onError('Erro na Validação', res.message || 'Código incorreto.');
            }
        } catch (err: any) {
            onError('Erro na Validação', err.message || 'Erro ao processar código.');
        }
    };

    return (
        <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-4 mb-4">
            <QRScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={(code) => handleConfirm(code)}
            />
            <div className="w-20 h-20 bg-zinc-950 rounded-xl overflow-hidden flex-shrink-0">
                <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                        <h4 className="font-bold text-white text-sm">
                            {order.is_lote ? `Lote: ${order.listing_title} + ${order.listing_ids.length - 1} itens` : order.listing_title}
                        </h4>
                        {order.is_lote && (
                            <span className="text-[8px] text-primary-400 font-black uppercase tracking-widest">
                                📦 {order.listing_ids.length} ITENS DO MESMO VENDEDOR
                            </span>
                        )}
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${order.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary-500/10 text-primary-400'}`}>
                        {order.status}
                    </span>
                </div>
                <p className="text-lg font-black text-white mt-1">{formatCurrency(parseFloat(order.amount))}</p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Pedido: #{order.id.toString().slice(-6)}</p>

                    {/* Botão de Rastreio (se houver entregador e não estiver concluído) */}
                    {order.courier_id && (order.status === 'WAITING_SHIPPING' || order.status === 'IN_TRANSIT') && (
                        <button
                            onClick={() => setTrackingOrder(order)}
                            className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-black border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all"
                        >
                            <Navigation2 size={12} className="animate-pulse" /> RASTREAR
                        </button>
                    )}

                    {/* Código de Segurança para o Comprador (Handshake) */}
                    {order.buyer_id === currentUser?.id && order.delivery_confirmation_code && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                        <div className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-3xl flex flex-col items-center gap-3 shadow-2xl shadow-primary-500/5">
                            <div className="bg-white p-2 rounded-2xl shadow-inner border-4 border-zinc-900">
                                <QRCodeSVG
                                    value={order.delivery_confirmation_code}
                                    size={100}
                                    level="H"
                                    includeMargin={false}
                                />
                            </div>
                            <div className="text-center">
                                <span className="text-[7px] text-primary-400 font-black uppercase tracking-[0.2em] mb-0.5 block">Código de Segurança Handshake</span>
                                <span className="text-lg font-mono font-black text-white tracking-[0.3em]">{order.delivery_confirmation_code}</span>
                            </div>
                        </div>
                    )}

                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                        {order.buyer_id === currentUser?.id ? 'Compra' : order.seller_id === currentUser?.id ? 'Venda' : 'Entrega'}
                    </span>

                    {/* Código de Coleta para o Vendedor/Entregador */}
                    {order.seller_id === currentUser?.id && order.pickup_code && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                        <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg flex flex-col">
                            <span className="text-[7px] text-amber-400 font-black uppercase tracking-tighter">Cód. P/ Coleta</span>
                            <span className="text-sm font-mono font-black text-white">{order.pickup_code}</span>
                        </div>
                    )}

                    {/* Código de Rastreio para Envio Externo */}
                    {order.tracking_code && (
                        <div className="bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-lg flex flex-col">
                            <span className="text-[8px] text-blue-400 font-black uppercase tracking-tighter">Rastreamento Nacional</span>
                            <span className="text-xs font-mono font-black text-white">{order.tracking_code}</span>
                        </div>
                    )}

                    {/* Endereço do Vendedor para Retirada (SELF_PICKUP) */}
                    {order.delivery_type === 'SELF_PICKUP' && order.buyer_id === currentUser?.id && (
                        <div className="w-full mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Navigation2 size={12} className="text-amber-400" />
                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">LOCAL DE RETIRADA</span>
                            </div>
                            <p className="text-xs text-white font-medium">
                                {correctStoredAddress(order.pickup_lat || null, order.pickup_lng || null, order.pickup_address || order.seller_address || '')}
                            </p>
                            {order.seller_phone && (
                                <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-400">
                                    <Phone size={10} />
                                    <span className="font-mono">{order.seller_phone}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {order.courier_name && (
                        <div className="flex flex-col gap-1 mt-4">
                            <div className="flex items-center gap-2 text-[10px] text-amber-500 font-black">
                                <div className="flex items-center gap-1"><Truck size={12} /> {order.courier_name}</div>
                                <div className="flex items-center gap-1 text-zinc-500 font-mono font-normal">
                                    <Phone size={10} /> {order.courier_phone}
                                </div>
                            </div>
                            {order.courier_vehicle_model && (
                                <div className="text-[9px] text-zinc-500 font-bold bg-zinc-800/50 px-2 py-1 rounded inline-flex items-center gap-2">
                                    <span className="text-zinc-600 uppercase">{order.courier_vehicle_type}</span>
                                    <span className="text-zinc-300">{order.courier_vehicle_model}</span>
                                    {order.courier_vehicle_plate && (
                                        <span className="bg-white/10 px-1 rounded text-white">{order.courier_vehicle_plate}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Conteúdo Digital (Curso/E-book) - Apenas para Comprador com Pedido Concluído ou Pago */}
                    {order.buyer_id === currentUser?.id && order.digital_content && (
                        <div className="w-full mt-4 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-xl p-3 flex flex-col gap-2">
                            <div className="flex items-center gap-2 mb-1">
                                <Download size={14} className="text-blue-400" />
                                <span className="text-xs font-black text-blue-100 uppercase tracking-wide">Conteúdo Digital Liberado</span>
                            </div>
                            <div className="bg-black/40 rounded-lg p-3 flex items-center justify-between gap-3">
                                <p className="text-xs text-zinc-300 font-mono truncate select-all">{order.digital_content}</p>
                                <button
                                    onClick={() => {
                                        if (order.digital_content.startsWith('http')) {
                                            window.open(order.digital_content, '_blank');
                                        } else {
                                            navigator.clipboard.writeText(order.digital_content);
                                            onSuccess('Copiado', 'Conteúdo copiado para área de transferência!');
                                        }
                                    }}
                                    className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                                    title={order.digital_content.startsWith('http') ? "Abrir Link" : "Copiar"}
                                >
                                    {order.digital_content.startsWith('http') ? <ExternalLink size={14} /> : <span className="text-[10px] font-bold">COPIAR</span>}
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-500">Este conteúdo é exclusivo para você. Não compartilhe.</p>
                        </div>
                    )}

                </div>

                {/* Ações de Ordem */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                    {/* Vendedor: Informar Rastreio */}
                    {order.seller_id === currentUser?.id && order.status === 'WAITING_SHIPPING' && order.delivery_type === 'EXTERNAL_SHIPPING' && (
                        <button
                            onClick={() => {
                                const code = prompt('Digite o código de rastreamento (Correios/Transportadora):');
                                if (code) {
                                    apiService.post(`/marketplace/order/${order.id}/ship`, { trackingCode: code })
                                        .then(() => { onSuccess('Sucesso', 'Produto enviado!'); fetchData(); })
                                        .catch((err: any) => onError('Erro', err.message));
                                }
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black px-4 py-2 rounded-lg transition-all uppercase tracking-widest"
                        >
                            Informar Envio
                        </button>
                    )}

                    {/* Vendedor: Antecipar Recebimento */}
                    {order.seller_id === currentUser?.id && !order.metadata?.anticipated && (order.status === 'WAITING_SHIPPING' || order.status === 'IN_TRANSIT') && (
                        <button
                            onClick={() => {
                                const amount = parseFloat(order.amount);
                                const anticipationFee = amount * 0.05;
                                const netEstimation = amount - anticipationFee;

                                setConfirmData({
                                    isOpen: true,
                                    title: 'Antecipar Recebimento?',
                                    message: `Receba o valor desta venda AGORA, sem esperar a entrega! \n\nValor Retido: ${formatCurrency(amount)}\nTaxa de Antecipação (5%): -${formatCurrency(anticipationFee)}\n\nVocê recebe na hora: ~${formatCurrency(netEstimation)}`,
                                    confirmText: `ANTECIPAR POR ${formatCurrency(anticipationFee)}`,
                                    type: 'success',
                                    onConfirm: async () => {
                                        try {
                                            const res = await apiService.post(`/marketplace/order/${order.id}/anticipate`, {});
                                            if (res.success) {
                                                onSuccess('Sucesso!', 'Valor antecipado e creditado no seu saldo!');
                                                fetchData();
                                                setConfirmData(null);
                                            }
                                        } catch (err: any) {
                                            onError('Erro', err.message);
                                        }
                                    }
                                });
                            }}
                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-orange-500/20 mr-2"
                        >
                            <Zap size={10} className="fill-black" /> Antecipar Recebimento
                        </button>
                    )}

                    {/* Entregador: Antecipar Frete */}
                    {order.courier_id === currentUser?.id && order.status === 'IN_TRANSIT' && !order.metadata?.courier_anticipated && (
                        <button
                            onClick={() => {
                                const deliveryFee = parseFloat(order.delivery_fee || '0');
                                const grossEarnings = deliveryFee * 0.85; // 85% para o entregador
                                const anticipationFee = grossEarnings * 0.05;
                                const netEarnings = grossEarnings - anticipationFee;

                                setConfirmData({
                                    isOpen: true,
                                    title: 'Antecipar Frete?',
                                    message: `Receba seu ganho pela entrega AGORA!\n\nGanho Previsto: ${formatCurrency(grossEarnings)}\nTaxa de Antecipação (5%): -${formatCurrency(anticipationFee)}\n\nVocê recebe na hora: ${formatCurrency(netEarnings)}`,
                                    confirmText: `ANTECIPAR FRETE`,
                                    type: 'success',
                                    onConfirm: async () => {
                                        try {
                                            const res = await apiService.post(`/marketplace/order/${order.id}/anticipate`, {});
                                            if (res.success) {
                                                onSuccess('Sucesso!', 'Frete antecipado e creditado!');
                                                fetchData();
                                                setConfirmData(null);
                                            }
                                        } catch (err: any) {
                                            onError('Erro', err.message);
                                        }
                                    }
                                });
                            }}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-purple-500/20 mr-2"
                        >
                            <Zap size={10} /> Antecipar Frete
                        </button>
                    )}

                    {/* Vendedor/Entregador: Validar Entrega via Código (Handshake) */}
                    {(order.seller_id === currentUser?.id || order.courier_id === currentUser?.id) && (order.status === 'WAITING_SHIPPING' || order.status === 'IN_TRANSIT') && order.status !== 'COMPLETED' && (
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={() => setIsScannerOpen(true)}
                                className="bg-primary-500 hover:bg-primary-400 text-black p-2.5 rounded-xl transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center group"
                                title="Escanear QR Code"
                            >
                                <Scan size={18} className="group-active:scale-90 transition-transform" />
                            </button>
                            <button
                                onClick={() => {
                                    const code = prompt('Solicite ao comprador o código de segurança de 6 dígitos:');
                                    if (code) handleConfirm(code);
                                }}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white text-[9px] font-black px-4 py-2.5 rounded-xl transition-all uppercase tracking-widest border border-white/5"
                            >
                                Validar via Código
                            </button>
                        </div>
                    )}

                    {/* Comprador: Confirmar Recebimento Manual */}
                    {order.buyer_id === currentUser?.id && (order.delivery_status === 'DELIVERED' || order.status === 'IN_TRANSIT') && order.status !== 'COMPLETED' && order.status !== 'RETURN_REQUESTED' && (
                        <button
                            onClick={() => {
                                setConfirmData({
                                    isOpen: true,
                                    title: 'Confirmar Recebimento?',
                                    message: 'Ao confirmar, o dinheiro será liberado para o vendedor e o entregador. Faça isso apenas se já estiver com o produto em mãos.',
                                    confirmText: 'CONFIRMAR RECEBIMENTO',
                                    type: 'success',
                                    onConfirm: async () => {
                                        try {
                                            const res = await apiService.post(`/marketplace/order/${order.id}/receive`, {});
                                            if (res.success) {
                                                onSuccess('Sucesso!', 'Pedido concluído! Vendedor e entregador receberam o pagamento.');
                                                fetchData();
                                                setConfirmData(null);
                                            }
                                        } catch (err: any) {
                                            onError('Erro', err.message);
                                        }
                                    }
                                });
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black px-4 py-2 rounded-lg transition-all uppercase tracking-widest shadow-lg shadow-emerald-600/20 flex items-center gap-1 ml-auto"
                        >
                            ✅ Confirmar Recebimento
                        </button>
                    )}

                    {/* Comprador: Solicitar Devolução (Arrependimento) */}
                    {order.buyer_id === currentUser?.id && (order.delivery_status === 'DELIVERED' || order.status === 'IN_TRANSIT') && order.status !== 'COMPLETED' && order.status !== 'RETURN_REQUESTED' && (
                        <button
                            onClick={() => {
                                const reason = prompt('Por que você deseja devolver este produto?');
                                if (reason) {
                                    apiService.post(`/marketplace/order/${order.id}/return`, { reason })
                                        .then(() => { onSuccess('Sucesso', 'Solicitação de devolução enviada. O saldo está bloqueado.'); fetchData(); })
                                        .catch((err: any) => onError('Erro', err.message));
                                }
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] font-black px-4 py-2 rounded-lg transition-all uppercase tracking-widest border border-white/5 ml-2"
                        >
                            🚨 Solicitar Devolução
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
