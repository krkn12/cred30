import React from 'react';
import { Truck, MapPin, Phone } from 'lucide-react';
import { VEHICLE_ICONS } from './marketplace.constants';
import { correctStoredAddress } from '../../../application/utils/location_corrections';

interface MissionsViewProps {
    missions: any[];
    currentUserId: string;
    formatCurrency: (value: number) => string;
    onAccept: (mission: any) => void;
    pricePerKm?: number;
    onUpdatePrice?: (newPrice: number) => void;
}

export const MissionsView = ({ missions, currentUserId, formatCurrency, onAccept, pricePerKm = 2.00, onUpdatePrice }: MissionsViewProps) => {
    const [editingPrice, setEditingPrice] = React.useState(false);
    const [tempPrice, setTempPrice] = React.useState(pricePerKm.toString());

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Painel de Configuração do Entregador */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Truck size={18} className="text-primary-400" /> Seu Perfil de Entregador
                    </h3>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Configurações de Ganhos</p>
                </div>

                <div className="flex items-center gap-3 bg-zinc-950 p-2 pl-4 rounded-2xl border border-zinc-800 w-full md:w-auto">
                    <div className="flex-1 md:flex-none">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">Preço por KM</p>
                        {editingPrice ? (
                            <input
                                type="number"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(e.target.value)}
                                className="bg-transparent text-white font-black text-lg w-20 outline-none border-b border-primary-500"
                                autoFocus
                            />
                        ) : (
                            <p className="text-lg font-black text-white">{formatCurrency(pricePerKm)} <span className="text-[10px] text-zinc-500 font-normal">/ km</span></p>
                        )}
                    </div>
                    {editingPrice ? (
                        <button
                            onClick={() => {
                                onUpdatePrice?.(parseFloat(tempPrice));
                                setEditingPrice(false);
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] px-4 py-2 rounded-xl uppercase transition"
                        >
                            Salvar
                        </button>
                    ) : (
                        <button
                            onClick={() => setEditingPrice(true)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white font-black text-[10px] px-4 py-2 rounded-xl uppercase transition border border-zinc-700"
                        >
                            Alterar
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-900/40 to-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Mural de Missões</h3>
                    <p className="text-sm text-zinc-400 max-w-sm">
                        Ganhe dinheiro extra ajudando outros membros com a logística. Aceite missões que cruzam com seu caminho.
                    </p>
                </div>
                <Truck className="absolute -right-4 -bottom-4 text-indigo-500/20 w-32 h-32 rotate-12" />
            </div>

            {missions.length === 0 ? (
                <div className="py-20 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl">
                    <Truck size={48} className="text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500 text-sm">Nenhuma missão de logística disponível no momento.</p>
                    <p className="text-[10px] text-zinc-600 mt-2">Novas oportunidades aparecem quando membros solicitam apoio.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {missions.map(mission => (
                        <div key={mission.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center group hover:border-indigo-500/40 transition-all">
                            <div className="w-16 h-16 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                                <img src={mission.imageUrl} alt={mission.itemTitle} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded uppercase tracking-widest">TRANSPORTE</span>
                                    {(() => {
                                        const VehicleIcon = VEHICLE_ICONS[mission.requiredVehicle] || Truck;
                                        return (
                                            <div className="flex items-center gap-1 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                                                <VehicleIcon size={10} className="text-primary-400" />
                                                <span className="text-[9px] text-zinc-400 font-bold uppercase">{mission.requiredVehicle || 'MOTO'}</span>
                                            </div>
                                        );
                                    })()}
                                    {mission.invited_courier_id === currentUserId && (
                                        <span className="text-[10px] font-black bg-amber-500 text-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">CONVITE</span>
                                    )}
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase">• {new Date(mission.createdAt).toLocaleDateString()}</span>
                                </div>
                                <h4 className="font-bold text-white text-base">{mission.itemTitle}</h4>
                                <div className="text-xs text-zinc-400 mt-2 flex flex-col gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2"><MapPin size={12} className="text-amber-500" /> <span className="text-zinc-500">Coleta:</span> <strong>{correctStoredAddress(mission.pickupLat || null, mission.pickupLng || null, mission.pickupAddress)}</strong> ({mission.sellerName.split(' ')[0]})</div>
                                        <div className="flex items-center gap-2 pl-5 text-[10px] text-zinc-500 font-mono"><Phone size={10} /> {mission.sellerPhone}</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2"><MapPin size={12} className="text-primary-500" /> <span className="text-zinc-500">Entrega:</span> <strong>{correctStoredAddress(mission.deliveryLat || null, mission.deliveryLng || null, mission.deliveryAddress)}</strong> ({mission.buyerName.split(' ')[0]})</div>
                                        <div className="flex items-center gap-2 pl-5 text-[10px] text-zinc-500 font-mono"><Phone size={10} /> {mission.buyerPhone}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-zinc-800">
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Recompensa</p>
                                    <p className="text-xl font-black text-emerald-400">{formatCurrency(parseFloat(mission.deliveryFee))}</p>
                                </div>
                                <button
                                    onClick={() => onAccept(mission)}
                                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20 text-xs uppercase tracking-widest"
                                >
                                    Aceitar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
