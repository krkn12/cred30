import React, { useEffect, useState } from 'react';
import { ShoppingBag, ExternalLink, Tag } from 'lucide-react';
import { Product } from '../../../../domain/types/common.types';
import { apiService } from '../../../../application/services/api.service';

export const StoreView: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const data = await apiService.getProducts();
            setProducts(data);
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <ShoppingBag size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">Loja de Parceiros</h2>
                    <p className="text-zinc-400 text-sm">Ofertas exclusivas para membros Cred30</p>
                </div>
            </div>

            {products.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
                    <div className="bg-zinc-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-500">
                        <ShoppingBag size={24} />
                    </div>
                    <h3 className="text-white font-medium mb-2">Nenhuma oferta disponível</h3>
                    <p className="text-zinc-500 text-sm">Volte mais tarde para conferir novidades!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map(product => (
                        <div key={product.id} className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden hover:border-purple-500/30 transition group flex flex-col">
                            <div className="aspect-video bg-zinc-900 relative overflow-hidden group">
                                {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-900/50">
                                        <ShoppingBag size={32} />
                                    </div>
                                )}
                                {product.category && (
                                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1 border border-white/10">
                                        {product.category}
                                    </div>
                                )}
                            </div>

                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-white text-lg mb-2 leading-tight group-hover:text-purple-400 transition">{product.title}</h3>
                                <p className="text-zinc-400 text-sm line-clamp-3 mb-6 flex-1">{product.description}</p>

                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                    {product.price ? (
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">A partir de</p>
                                            <p className="text-emerald-400 font-bold text-lg">R$ {product.price.toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    ) : <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1"><Tag size={12} /> Oferta Especial</div>}

                                    <a
                                        href={product.affiliateUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40"
                                    >
                                        ACESSAR <ExternalLink size={12} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
