import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, X, Truck, Package, Phone, User, Navigation } from 'lucide-react';

interface DeliveryMission {
    id: string;
    delivery_fee: number;
    delivery_address: string;
    pickup_address: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
    item_title: string;
    image_url: string | null;
    seller_name: string;
    buyer_name: string;
    buyer_phone: string;
    seller_phone: string;
}

interface AvailableDeliveriesMapProps {
    deliveries: DeliveryMission[];
    onAccept: (deliveryId: string) => Promise<void>;
    onIgnore: (deliveryId: string) => void;
    onClose: () => void;
}

export const AvailableDeliveriesMap: React.FC<AvailableDeliveriesMapProps> = ({
    deliveries,
    onAccept,
    onIgnore,
    onClose
}) => {
    // ... existing refs and state ...
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const [selectedDelivery, setSelectedDelivery] = useState<DeliveryMission | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);

    // ... existing icons and geocode logic ...

    // Ícones personalizados
    const pickupIcon = L.divIcon({
        html: `<div class="bg-amber-500 p-2 rounded-full shadow-lg border-2 border-white animate-pulse">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5">
                    <path d="M21 10h-4l-1-3H8L7 10H3M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
                    <circle cx="9" cy="17" r="2" />
                    <circle cx="15" cy="17" r="2" />
                </svg>
              </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    const deliveryIcon = L.divIcon({
        html: `<div class="bg-rose-500 p-2 rounded-full shadow-lg border-2 border-white">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
              </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
            );
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }
        } catch (err) {
            console.error('Geocoding error:', err);
        }
        return null;
    };

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        mapRef.current = L.map(mapContainerRef.current, {
            zoomControl: true,
            attributionControl: false
        }).setView([-14.235, -51.9253], 4);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(mapRef.current);

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        const bounds: L.LatLngExpression[] = [];

        const addMarkers = async () => {
            for (const delivery of deliveries) {
                if (!mapRef.current) return;

                let pickupCoords = null;
                let deliveryCoords = null;

                if (delivery.pickup_lat && delivery.pickup_lng) {
                    pickupCoords = { lat: delivery.pickup_lat, lng: delivery.pickup_lng };
                } else if (delivery.pickup_address) {
                    pickupCoords = await geocodeAddress(delivery.pickup_address);
                }

                if (delivery.delivery_lat && delivery.delivery_lng) {
                    deliveryCoords = { lat: delivery.delivery_lat, lng: delivery.delivery_lng };
                } else if (delivery.delivery_address) {
                    deliveryCoords = await geocodeAddress(delivery.delivery_address);
                }

                if (pickupCoords) {
                    const pickupMarker = L.marker([pickupCoords.lat, pickupCoords.lng], { icon: pickupIcon })
                        .addTo(mapRef.current!)
                        .on('click', () => setSelectedDelivery(delivery));

                    markersRef.current.push(pickupMarker);
                    bounds.push([pickupCoords.lat, pickupCoords.lng]);
                }

                if (deliveryCoords) {
                    const deliveryMarker = L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon: deliveryIcon })
                        .addTo(mapRef.current!)
                        .on('click', () => setSelectedDelivery(delivery));

                    markersRef.current.push(deliveryMarker);
                    bounds.push([deliveryCoords.lat, deliveryCoords.lng]);
                }
            }

            if (bounds.length > 0 && mapRef.current) {
                mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
            }
        };

        addMarkers();
    }, [deliveries]);

    const handleAcceptDelivery = async () => {
        if (!selectedDelivery) return;

        setIsAccepting(true);
        try {
            await onAccept(selectedDelivery.id);
            setSelectedDelivery(null);
        } catch (error) {
            console.error('Error accepting delivery:', error);
        } finally {
            setIsAccepting(false);
        }
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };


    return (
        <div className="fixed inset-0 z-[200] bg-black animate-in fade-in duration-300 flex flex-col">
            {/* Header */}
            <div className="p-4 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center border border-primary-500/20">
                        <Navigation className="text-primary-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-white font-black text-sm uppercase tracking-tighter">Entregas Disponíveis</h2>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">{deliveries.length} missões ativas</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
                <div ref={mapContainerRef} className="w-full h-full bg-zinc-900" />

                {/* Legenda - Mais compacta em mobile */}
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-2 sm:p-3 rounded-xl shadow-2xl">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <div className="w-4 h-4 sm:w-6 sm:h-6 bg-amber-500 rounded-full" />
                        <span className="text-[10px] sm:text-xs text-white font-medium">Coleta</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-4 h-4 sm:w-6 sm:h-6 bg-rose-500 rounded-full" />
                        <span className="text-[10px] sm:text-xs text-white font-medium">Entrega</span>
                    </div>
                </div>

                {/* Informação se não houver entregas */}
                {deliveries.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm">
                        <div className="text-center space-y-4">
                            <Truck className="w-16 h-16 text-zinc-700 mx-auto" />
                            <p className="text-zinc-400 font-bold text-sm">Nenhuma entrega disponível no momento</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Detalhes da Entrega */}
            {selectedDelivery && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[10] animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                        {/* Header do Modal */}
                        <div className="p-6 border-b border-zinc-800 flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                {selectedDelivery.image_url ? (
                                    <img
                                        src={selectedDelivery.image_url}
                                        alt={selectedDelivery.item_title}
                                        className="w-16 h-16 rounded-xl object-cover border border-zinc-800"
                                    />
                                ) : (
                                    <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center">
                                        <Package className="text-zinc-600" size={24} />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-base line-clamp-2">{selectedDelivery.item_title}</h3>
                                    <p className="text-primary-400 font-black text-xl mt-1">
                                        {formatCurrency(selectedDelivery.delivery_fee)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDelivery(null)}
                                className="p-2 hover:bg-zinc-800 rounded-lg transition"
                            >
                                <X className="text-zinc-500" size={20} />
                            </button>
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="p-6 space-y-4">
                            {/* Coleta */}
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                                        <MapPin className="text-white" size={16} />
                                    </div>
                                    <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Coleta</span>
                                </div>
                                <p className="text-white text-sm font-medium mb-2">{selectedDelivery.pickup_address}</p>
                                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                    <User size={14} />
                                    <span>{selectedDelivery.seller_name}</span>
                                </div>
                                {selectedDelivery.seller_phone && (
                                    <div className="flex items-center gap-2 text-zinc-400 text-xs mt-1">
                                        <Phone size={14} />
                                        <span>{selectedDelivery.seller_phone}</span>
                                    </div>
                                )}
                            </div>

                            {/* Entrega */}
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center">
                                        <MapPin className="text-white" size={16} />
                                    </div>
                                    <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Destino</span>
                                </div>
                                <p className="text-white text-sm font-medium mb-2">{selectedDelivery.delivery_address}</p>
                                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                    <User size={14} />
                                    <span>{selectedDelivery.buyer_name}</span>
                                </div>
                                {selectedDelivery.buyer_phone && (
                                    <div className="flex items-center gap-2 text-zinc-400 text-xs mt-1">
                                        <Phone size={14} />
                                        <span>{selectedDelivery.buyer_phone}</span>
                                    </div>
                                )}
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        onIgnore(selectedDelivery.id);
                                        setSelectedDelivery(null);
                                    }}
                                    className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl font-bold text-sm transition"
                                >
                                    Ignorar
                                </button>
                                <button
                                    onClick={handleAcceptDelivery}
                                    disabled={isAccepting}
                                    className="flex-1 py-3 bg-primary-500 hover:bg-primary-400 text-black rounded-xl font-black text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isAccepting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            Aceitando...
                                        </>
                                    ) : (
                                        <>
                                            <Truck size={18} />
                                            ACEITAR ENTREGA
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
