import { MapPin, Navigation2, CheckCircle2, Truck, Image as ImageIcon, Tag, FileText, DollarSign, Archive, Plus } from 'lucide-react';
import { VEHICLE_ICONS, MARKETPLACE_CATEGORIES } from './marketplace.constants';
import { LoadingButton } from '../ui/LoadingButton';

interface CreateListingViewProps {
    newListing: any;
    setNewListing: (listing: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    onGetGPS: () => void;
    gpsLocation: any;
    setGpsLocation: (loc: any) => void;
    isSubmitting: boolean;
}

export const CreateListingView = ({
    newListing,
    setNewListing,
    onSubmit,
    onCancel,
    onGetGPS,
    gpsLocation,
    setGpsLocation,
    isSubmitting
}: CreateListingViewProps) => {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                O que você quer vender?
            </h3>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex gap-3 text-left">
                <MapPin size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-bold text-blue-100">Localização do Anúncio</p>
                    <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                        Defina onde seu produto está para aparecer para compradores próximos.
                    </p>

                    <button
                        type="button"
                        onClick={onGetGPS}
                        className={`mt-3 w-full sm:w-auto ${gpsLocation ? 'bg-emerald-500 text-white' : 'bg-blue-500 hover:bg-blue-400 text-white'} px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-lg`}
                    >
                        {gpsLocation ? <CheckCircle2 size={14} /> : <Navigation2 size={14} />}
                        {gpsLocation ? 'LOCALIZAÇÃO DEFINIDA' : 'USAR LOCALIZAÇÃO ATUAL (GPS)'}
                    </button>

                    {gpsLocation ? (
                        <div className="mt-4 space-y-3 p-3 bg-zinc-950/50 rounded-xl border border-blue-500/20">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Confirme o Endereço</span>
                                {gpsLocation.accuracy && (
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${gpsLocation.accuracy > 100 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                        Precisão: {Math.round(gpsLocation.accuracy)}m
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase ml-1">Bairro / Rua</label>
                                    <input
                                        type="text"
                                        value={gpsLocation.neighborhood}
                                        onChange={(e) => setGpsLocation({ ...gpsLocation, neighborhood: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none"
                                        placeholder="Ex: Tapanã / Passagem Dois Amigos"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-zinc-500 font-bold uppercase ml-1">CEP / Postal Code</label>
                                        <input
                                            type="text"
                                            value={gpsLocation.postalCode || ''}
                                            onChange={(e) => setGpsLocation({ ...gpsLocation, postalCode: e.target.value })}
                                            placeholder="00000-000"
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-zinc-500 font-bold uppercase ml-1">UF</label>
                                            <input
                                                type="text"
                                                value={gpsLocation.state}
                                                onChange={(e) => setGpsLocation({ ...gpsLocation, state: e.target.value.toUpperCase().slice(0, 2) })}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {gpsLocation.accuracy > 100 && (
                                <p className="text-[9px] text-amber-500/70 italic leading-tight">
                                    ⚠️ O GPS está oscilando. Se o nome da rua estiver errado (ex: Rua Lula), apague e digite o correto acima.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-[10px] text-blue-200/50 mt-2">
                            *Isso atualizará a localização do seu perfil de vendedor.
                        </p>
                    )}
                </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Título do Anúncio</label>
                    </div>
                    <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            value={newListing.title}
                            onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                            placeholder="Ex: iPhone 13 Pro Max 256GB"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Descrição Detalhada</label>
                    <div className="relative">
                        <FileText className="absolute left-4 top-4 text-zinc-500" size={18} />
                        <textarea
                            value={newListing.description}
                            onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white h-32 focus:outline-none focus:border-primary-500/50"
                            placeholder="Descreva o estado do produto, tempo de uso, acessórios inclusos..."
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Preço de Venda</label>
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input
                                type="number"
                                value={newListing.price}
                                onChange={(e) => setNewListing({ ...newListing, price: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                placeholder="0,00"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Estoque Inicial</label>
                        <div className="relative">
                            <Archive className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input
                                type="number"
                                value={newListing.stock}
                                onChange={(e) => setNewListing({ ...newListing, stock: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                placeholder="Ex: 5"
                                min="1"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Categoria</label>
                        <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <select
                                value={newListing.category}
                                onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50 appearance-none"
                            >
                                {MARKETPLACE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Local de Retirada (Opcional)</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input
                                type="text"
                                value={newListing.pickupAddress}
                                onChange={(e) => setNewListing({ ...newListing, pickupAddress: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                placeholder="Rua, número, etc"
                            />
                        </div>
                    </div>
                </div>

                {/* VEÍCULO REQUERIDO PARA ENTREGA */}
                {newListing.category !== 'PARTICIPAÇÕES' && (
                    <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-4 space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                            <Truck size={12} className="text-primary-400" /> Veículo necessário para o frete
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {(['BIKE', 'MOTO', 'CAR', 'TRUCK'] as const).map((v) => {
                                const Icon = VEHICLE_ICONS[v];
                                const isSelected = newListing.requiredVehicle === v;
                                return (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => setNewListing({ ...newListing, requiredVehicle: v })}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${isSelected ? 'bg-primary-500/10 border-primary-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}
                                    >
                                        <Icon size={16} />
                                        <span className="text-[8px] font-black uppercase">{v}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[9px] text-zinc-500 italic mt-1 leading-tight">
                            Isso ajuda o entregador a saber se o item cabe no veículo dele.
                        </p>
                    </div>
                )}

                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-2 block">Fotos do Produto (Máx 5)</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {/* Main Image / First Image */}
                        <div className="relative w-24 h-24 shrink-0 transition-all hover:opacity-90 group">
                            <div className="w-full h-full bg-zinc-950 border-2 border-primary-500/50 rounded-xl overflow-hidden flex items-center justify-center">
                                {newListing.images && newListing.images.length > 0 ? (
                                    <img src={newListing.images[0]} alt="Principal" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="text-zinc-800" />
                                )}
                            </div>
                            {newListing.images && newListing.images.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newImgs = [...newListing.images];
                                        newImgs.shift();
                                        setNewListing({ ...newListing, images: newImgs, image_url: newImgs[0] || '' });
                                    }}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-sm"
                                >
                                    <Archive size={10} />
                                </button>
                            )}
                            <span className="absolute bottom-1 right-1 bg-primary-500 text-black text-[8px] font-black px-1.5 rounded uppercase">Capa</span>
                        </div>

                        {/* Additional Images */}
                        {newListing.images && newListing.images.map((img: string, idx: number) => {
                            if (idx === 0) return null; // Skip first
                            return (
                                <div key={idx} className="relative w-24 h-24 shrink-0 group">
                                    <div className="w-full h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                                        <img src={img} alt={`Foto ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newImgs = newListing.images.filter((_: any, i: number) => i !== idx);
                                            setNewListing({ ...newListing, images: newImgs });
                                        }}
                                        className="absolute -top-1 -right-1 bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-sm border border-zinc-700"
                                    >
                                        <Archive size={10} />
                                    </button>
                                </div>
                            );
                        })}

                        {/* Add Button */}
                        {(newListing.images?.length || 0) < 5 && (
                            <label className="w-24 h-24 bg-zinc-900 border border-dashed border-zinc-700 hover:border-primary-500/50 hover:bg-zinc-800 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1 transition group">
                                <Plus size={20} className="text-zinc-600 group-hover:text-primary-400" />
                                <span className="text-[9px] text-zinc-600 group-hover:text-primary-400 font-bold uppercase">Adicionar</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (readerEvent) => {
                                                const img = new Image();
                                                img.onload = () => {
                                                    const canvas = document.createElement('canvas');
                                                    const ctx = canvas.getContext('2d');
                                                    const size = 800;
                                                    canvas.width = size;
                                                    canvas.height = size;
                                                    const ratio = Math.max(size / img.width, size / img.height);
                                                    const centerShift_x = (size - img.width * ratio) / 2;
                                                    const centerShift_y = (size - img.height * ratio) / 2;
                                                    if (ctx) {
                                                        ctx.clearRect(0, 0, size, size);
                                                        ctx.drawImage(img, 0, 0, img.width, img.height,
                                                            centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
                                                        const dataUrl = canvas.toDataURL('image/jpeg', 0.80);

                                                        const currentImages = newListing.images || [];
                                                        const newImages = [...currentImages, dataUrl];
                                                        setNewListing({
                                                            ...newListing,
                                                            images: newImages,
                                                            image_url: newImages[0] // Ensure main image is set
                                                        });
                                                    }
                                                };
                                                img.src = readerEvent.target?.result as string;
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* VARIANTS SECTION */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-between">
                        <span>Variações (Cor, Tamanho, Estoque)</span>
                        <span className="text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded text-[9px]">{newListing.variants?.length || 0} Variantes</span>
                    </label>

                    {(!newListing.variants || newListing.variants.length === 0) ? (
                        <div className="text-center py-4 border border-dashed border-zinc-800 rounded-xl">
                            <p className="text-[10px] text-zinc-600 mb-2">Este produto tem cores ou tamanhos diferentes?</p>
                            <button
                                type="button"
                                onClick={() => setNewListing({ ...newListing, variants: [{ color: '', size: '', stock: 1 }] })}
                                className="text-primary-400 text-xs font-bold uppercase hover:underline"
                            >
                                + Adicionar Variação
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {newListing.variants.map((variant: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                                    <div className="col-span-4">
                                        <input
                                            type="text"
                                            placeholder="Cor (Ex: Azul)"
                                            value={variant.color}
                                            onChange={(e) => {
                                                const newVars = [...newListing.variants];
                                                newVars[idx].color = e.target.value;
                                                setNewListing({ ...newListing, variants: newVars });
                                            }}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="text"
                                            placeholder="Tam. (M)"
                                            value={variant.size}
                                            onChange={(e) => {
                                                const newVars = [...newListing.variants];
                                                newVars[idx].size = e.target.value;
                                                setNewListing({ ...newListing, variants: newVars });
                                            }}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="number"
                                            placeholder="Qtd"
                                            value={variant.stock}
                                            onChange={(e) => {
                                                const newVars = [...newListing.variants];
                                                newVars[idx].stock = parseInt(e.target.value) || 0;
                                                // Auto update total stock
                                                const total = newVars.reduce((acc, v) => acc + (v.stock || 0), 0);
                                                setNewListing({ ...newListing, variants: newVars, stock: total.toString() });
                                            }}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white text-center"
                                        />
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newVars = newListing.variants.filter((_: any, i: number) => i !== idx);
                                                const total = newVars.reduce((acc: any, v: any) => acc + (v.stock || 0), 0);
                                                setNewListing({ ...newListing, variants: newVars, stock: newVars.length > 0 ? total.toString() : '1' });
                                            }}
                                            className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                                        >
                                            <Archive size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    const newVars = [...newListing.variants, { color: '', size: '', stock: 1 }];
                                    const total = newVars.reduce((acc, v) => acc + (v.stock || 0), 0);
                                    setNewListing({ ...newListing, variants: newVars, stock: total.toString() });
                                }}
                                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-bold uppercase rounded-xl transition"
                            >
                                + Adicionar Outra Opção
                            </button>
                        </div>
                    )}
                </div>

                <div className="pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold rounded-2xl transition hover:bg-zinc-700 uppercase tracking-widest text-[10px]"
                    >
                        Cancelar
                    </button>
                    <LoadingButton
                        type="submit"
                        isLoading={isSubmitting}
                        loadingText="PUBLICANDO..."
                        className="flex-[2] py-4 bg-primary-500 text-black font-black rounded-2xl transition hover:bg-primary-400 shadow-lg shadow-primary-500/20 uppercase tracking-widest text-[10px]"
                    >
                        PUBLICAR ANÚNCIO AGORA
                    </LoadingButton>
                </div>
            </form>
        </div>
    );
};
