
import React, { useState } from 'react';
import { X, Save, Trash2, Package, Tag, Type } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface EditListingModalProps {
    listing: any;
    onClose: () => void;
    onSuccess: () => void;
    onError: (title: string, message: string) => void;
}

export const EditListingModal = ({ listing, onClose, onSuccess, onError }: EditListingModalProps): JSX.Element => {
    const [formData, setFormData] = useState({
        title: listing.title,
        price: listing.price,
        stock: listing.stock
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await apiService.put(`/marketplace/listings/${listing.id}`, {
                title: formData.title,
                price: parseFloat(formData.price.toString()),
                stock: parseInt(formData.stock.toString())
            });

            if (res.success) {
                onSuccess();
                onClose();
            } else {
                onError('Erro ao Atualizar', res.message || 'Não foi possível salvar as alterações.');
            }
        } catch (error) {
            console.error(error);
            onError('Erro de Conexão', 'Verifique sua internet e tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Tem certeza que deseja excluir este anúncio? Essa ação não pode ser desfeita.')) return;

        setIsDeleting(true);
        try {
            const res = await apiService.delete(`/marketplace/listings/${listing.id}`);
            if (res.success) {
                onSuccess();
                onClose();
            } else {
                onError('Erro ao Excluir', res.message || 'Não foi possível remover o anúncio.');
            }
        } catch (error) {
            console.error(error);
            onError('Erro de Conexão', 'Falha ao tentar excluir o anúncio.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl relative">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <h3 className="text-xl font-black text-white tracking-tight">Editar Anúncio</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSave} className="p-6 space-y-4">

                    {/* Imagem Preview (Read-only por enquanto) */}
                    <div className="flex justify-center mb-4">
                        <div className="w-32 h-32 rounded-2xl bg-zinc-800 overflow-hidden border border-zinc-700 relative group">
                            <img src={listing.image_url} alt="Produto" className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-zinc-300 font-bold uppercase text-center px-2">Imagem Fixa</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                <Type size={14} className="text-primary-500" /> Título do Produto
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500/50 transition-all font-medium"
                                placeholder="Ex: Bolo de Pote"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                    <Tag size={14} className="text-emerald-500" /> Preço (R$)
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    step="0.01"
                                    min="0.01"
                                    value={formData.price}
                                    onChange={handleChange}
                                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono font-bold"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                    <Package size={14} className="text-blue-500" /> Estoque
                                </label>
                                <input
                                    type="number"
                                    name="stock"
                                    min="0"
                                    value={formData.stock}
                                    onChange={handleChange}
                                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono font-bold"
                                    placeholder="0"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-6 flex gap-3">
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting || isSubmitting}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border border-red-500/20"
                        >
                            {isDeleting ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                            Excluir
                        </button>

                        <button
                            type="submit"
                            disabled={isDeleting || isSubmitting}
                            className="flex-[2] bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-primary-500/20"
                        >
                            {isSubmitting ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
