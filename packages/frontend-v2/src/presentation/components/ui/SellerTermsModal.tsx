import React, { useState, useRef } from 'react';
import { Store, ScrollText, CheckCircle2, X, AlertTriangle } from 'lucide-react';

// ==========================================================
// 📜 Modal de Termos do Marketplace para Vendedores
// Compliance CDC e responsabilidade do vendedor
// ==========================================================

interface SellerTermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
}

export const SellerTermsModal: React.FC<SellerTermsModalProps> = ({ isOpen, onClose, onAccept }) => {
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Função para verificar se o usuário scrollou até o final
    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            // Margem de erro de 10px para dispositivos móveis
            if (scrollHeight - scrollTop - clientHeight < 10) {
                setHasScrolledToBottom(true);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-end sm:justify-center animate-in fade-in duration-300 backdrop-blur-md">
            <div className="bg-zinc-950 sm:bg-zinc-900 border-t sm:border border-zinc-800 w-full sm:max-w-4xl h-[95dvh] sm:h-auto sm:max-h-[90vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col relative overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.1)]">
                {/* Header */}
                <div className="p-5 md:p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 border border-purple-500/20">
                            <Store size={20} className="md:size-24" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight">Termos do Vendedor</h2>
                            <p className="text-zinc-500 text-[10px] md:text-sm font-bold uppercase tracking-widest leading-none mt-1">Marketplace Cred30</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white p-2 bg-white/5 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar scroll-smooth"
                >
                    {/* Seção 1 - Natureza da Relação */}
                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-purple-400 flex items-center gap-2">
                            1. Natureza da Relação
                        </h3>
                        <p className="text-zinc-400 leading-relaxed text-sm md:text-base">
                            O <strong className="text-white">Cred30</strong> atua exclusivamente como <strong className="text-white">intermediário</strong> entre vendedores e compradores, disponibilizando tecnologia para conexão de usuários. <strong className="text-purple-300">A plataforma NÃO é parte nas transações de compra e venda.</strong>
                        </p>
                    </section>

                    {/* Seção 2 - Responsabilidade do Vendedor */}
                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-purple-400 flex items-center gap-2">
                            2. Responsabilidades do Vendedor
                        </h3>
                        <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800 space-y-3">
                            <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                                Ao cadastrar produtos no Marketplace, você declara e concorda que:
                            </p>
                            <ul className="text-zinc-400 text-xs md:text-sm space-y-2">
                                <li className="flex gap-2">
                                    <span className="text-purple-400">•</span>
                                    É o <strong className="text-white">único responsável</strong> pela qualidade, especificações e veracidade das informações do produto.
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-purple-400">•</span>
                                    Possui <strong className="text-white">autorização legal</strong> para comercializar os itens anunciados.
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-purple-400">•</span>
                                    Cumprirá o <strong className="text-white">prazo de envio</strong> informado no anúncio.
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-purple-400">•</span>
                                    Arcará com <strong className="text-white">garantia legal</strong> de 90 dias (Art. 26 CDC) para produtos não duráveis e 90 dias para duráveis.
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-purple-400">•</span>
                                    Respeitará o <strong className="text-white">direito de arrependimento</strong> de 7 dias (Art. 49 CDC) do comprador.
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Seção 3 - Isenção da Plataforma */}
                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-red-500 flex items-center gap-2">
                            <AlertTriangle size={20} />
                            3. Isenção de Responsabilidade da Plataforma
                        </h3>
                        <div className="bg-red-500/10 border-2 border-red-500/30 p-5 rounded-2xl space-y-3">
                            <p className="text-red-300 text-sm md:text-base font-bold">
                                O CRED30 NÃO SE RESPONSABILIZA:
                            </p>
                            <ul className="text-zinc-400 text-xs md:text-sm space-y-2">
                                <li>❌ Pela qualidade, segurança ou legalidade dos produtos anunciados</li>
                                <li>❌ Pela veracidade das descrições e fotos dos anúncios</li>
                                <li>❌ Por atrasos ou falhas na entrega causadas pelo vendedor</li>
                                <li>❌ Por danos decorrentes do uso de produtos adquiridos</li>
                                <li>❌ Por negociações realizadas fora da plataforma</li>
                            </ul>
                        </div>
                    </section>

                    {/* Seção 4 - Taxas e Comissões */}
                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-purple-400 flex items-center gap-2">
                            4. Taxas e Comissões
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                                <h4 className="font-bold text-white mb-2 text-sm md:text-base">Taxa de Marketplace</h4>
                                <p className="text-zinc-500 text-xs md:text-sm leading-relaxed">
                                    <strong className="text-purple-400">5%</strong> do valor da venda, descontado automaticamente do repasse ao vendedor.
                                </p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                                <h4 className="font-bold text-white mb-2 text-sm md:text-base">Prazo de Repasse</h4>
                                <p className="text-zinc-500 text-xs md:text-sm leading-relaxed">
                                    O valor é creditado na carteira <strong className="text-white">imediatamente após confirmação</strong> de recebimento pelo comprador.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 5 - Penalidades */}
                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-purple-400 flex items-center gap-2">
                            5. Penalidades por Descumprimento
                        </h3>
                        <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                            <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                                O descumprimento dos termos pode resultar em:
                            </p>
                            <ul className="text-zinc-400 text-xs md:text-sm space-y-1 mt-3">
                                <li>• Suspensão temporária ou permanente do direito de vender</li>
                                <li>• Retenção de valores para ressarcimento do comprador</li>
                                <li>• Exclusão definitiva da plataforma</li>
                                <li>• Comunicação às autoridades competentes em caso de fraude</li>
                            </ul>
                        </div>
                    </section>

                    {/* Seção 6 - Aceite */}
                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-purple-400 flex items-center gap-2">
                            6. Aceite Digital
                        </h3>
                        <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                            Ao clicar em "Aceitar", você declara ter <strong className="text-white">18 anos ou mais</strong>,
                            possuir plena capacidade civil e que leu, compreendeu e concorda com todos os termos acima.
                            Este aceite possui <strong className="text-white">validade jurídica</strong> nos termos do Art. 10 da MP 2.200-2/2001.
                        </p>
                    </section>

                    <div className="pt-10 border-t border-zinc-900 text-center space-y-2">
                        <p className="text-zinc-500 text-sm italic">
                            Fim dos termos. Role até o fim para habilitar o botão de aceite.
                        </p>
                        <p className="text-[10px] text-purple-600 font-bold">
                            Versão 1.0 • 02/02/2026
                        </p>
                    </div>
                </div>

                {/* Footer / Action */}
                <div className="p-6 md:p-8 border-t border-zinc-800 bg-zinc-950 flex flex-col gap-4">
                    {!hasScrolledToBottom && (
                        <p className="text-amber-500 text-xs font-medium flex items-center gap-2 justify-center mb-2 animate-pulse">
                            <ScrollText size={14} /> Você deve ler até o final para aceitar
                        </p>
                    )}

                    <button
                        onClick={onAccept}
                        disabled={!hasScrolledToBottom}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 text-base md:text-lg shadow-2-xl ${hasScrolledToBottom
                            ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/20'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                            }`}
                    >
                        {hasScrolledToBottom ? <CheckCircle2 size={24} /> : <div className="w-6 h-6 border-2 border-zinc-600 rounded-full" />}
                        Eu li e aceito os Termos do Vendedor
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SellerTermsModal;
