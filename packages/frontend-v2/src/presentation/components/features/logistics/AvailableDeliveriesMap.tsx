import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, X, Truck, Package, Phone, User, Navigation2, Info } from 'lucide-react';
import { applyLocationCorrection, correctStoredAddress } from '../../../application/utils/location_corrections';

interface DeliveryMission {
    id: string;
    order_id: string;
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
    isEmbedded?: boolean;
}

export const AvailableDeliveriesMap: React.FC<AvailableDeliveriesMapProps> = ({
    deliveries,
    onAccept,
    onIgnore,
    onClose,
    isEmbedded = false
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const [selectedDelivery, setSelectedDelivery] = useState<DeliveryMission | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);

    // Ícones personalizados
    const pickupIcon = L.divIcon({
        html: `<div class="bg-amber-500 p-2 rounded-full shadow-lg border-2 border-white animate-pulse">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    const deliveryIcon = L.divIcon({
        html: `<div class="bg-rose-500 p-2 rounded-full shadow-lg border-2 border-white">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
        </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    // Função para calcular distância entre dois pontos (Haversine) em metros
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Raio da Terra em metros
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distância em metros
    };

    const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [passedMarkers, setPassedMarkers] = useState<Set<string>>(new Set());
    const [reachedMarkers, setReachedMarkers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        mapRef.current = L.map(mapContainerRef.current, {
            zoomControl: true,
            attributionControl: false
        }).setView([-14.235, -51.9253], 4);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 20
        }).addTo(mapRef.current);

        if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserCoords({ lat: latitude, lng: longitude });

                    if (mapRef.current && !userCoords) {
                        mapRef.current.flyTo([latitude, longitude], 15);
                    }
                },
                (error) => console.log('Location error:', error),
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 5000
                }
            );

            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, []);

    const handleRecenter = () => {
        if (mapRef.current && userCoords) {
            mapRef.current.flyTo([userCoords.lat, userCoords.lng], 15);
        }
    };

    useEffect(() => {
        if (!mapRef.current || !userCoords) return;

        // Limpar marcadores anteriores
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Adicionar localização do usuário e círculo de acurácia
        L.circleMarker([userCoords.lat, userCoords.lng], {
            radius: 8,
            fillColor: "#3b82f6",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(mapRef.current).bindPopup("Sua localização");

        // Círculo de Precisão (Acurácia)
        const accuracyCircle = L.circle([userCoords.lat, userCoords.lng], {
            radius: 300,
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            color: "#3b82f6",
            weight: 1,
            dashArray: '5, 5'
        }).addTo(mapRef.current);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                accuracyCircle.setRadius(pos.coords.accuracy);
            });
        }

        const sortedDeliveries = [...deliveries];
        const newPassed = new Set(passedMarkers);
        const newReached = new Set(reachedMarkers);
        let stateUpdated = false;

        for (const delivery of sortedDeliveries) {
            if (!mapRef.current) return;

            const pickupPos = delivery.pickup_lat && delivery.pickup_lng ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng } : null;
            const deliveryPos = delivery.delivery_lat && delivery.delivery_lng ? { lat: delivery.delivery_lat, lng: delivery.delivery_lng } : null;

            const pickupId = `pickup-${delivery.order_id}`;
            const deliveryId = `delivery-${delivery.order_id}`;

            if (pickupPos && !newPassed.has(pickupId)) {
                const dist = calculateDistance(userCoords.lat, userCoords.lng, pickupPos.lat, pickupPos.lng);
                if (dist < 50) {
                    if (!newReached.has(pickupId)) { newReached.add(pickupId); stateUpdated = true; }
                } else if (dist > 70 && newReached.has(pickupId)) {
                    newPassed.add(pickupId); stateUpdated = true;
                }

                if (dist <= 30000 && !newPassed.has(pickupId)) {
                    const m = L.marker([pickupPos.lat, pickupPos.lng], { icon: pickupIcon, zIndexOffset: 1000 })
                        .addTo(mapRef.current!)
                        .on('click', () => setSelectedDelivery(delivery));
                    markersRef.current.push(m);
                }
            }

            if (deliveryPos && !newPassed.has(deliveryId)) {
                const dist = calculateDistance(userCoords.lat, userCoords.lng, deliveryPos.lat, deliveryPos.lng);
                if (dist < 50) {
                    if (!newReached.has(deliveryId)) { newReached.add(deliveryId); stateUpdated = true; }
                } else if (dist > 70 && newReached.has(deliveryId)) {
                    newPassed.add(deliveryId); stateUpdated = true;
                }

                if (dist <= 30000 && !newPassed.has(deliveryId)) {
                    const m = L.marker([deliveryPos.lat, deliveryPos.lng], { icon: deliveryIcon })
                        .addTo(mapRef.current!)
                        .on('click', () => setSelectedDelivery(delivery));
                    markersRef.current.push(m);
                }
            }
        }

        if (stateUpdated) {
            setReachedMarkers(newReached);
            setPassedMarkers(newPassed);
        }
    }, [deliveries, userCoords]);

    const routeLayerRef = useRef<L.Polyline | null>(null);

    useEffect(() => {
        if (routeLayerRef.current) {
            routeLayerRef.current.remove();
            routeLayerRef.current = null;
        }

        const drawRoute = async () => {
            if (!selectedDelivery || !mapRef.current) return;

            const start = selectedDelivery.pickup_lat && selectedDelivery.pickup_lng ? { lat: selectedDelivery.pickup_lat, lng: selectedDelivery.pickup_lng } : null;
            const end = selectedDelivery.delivery_lat && selectedDelivery.delivery_lng ? { lat: selectedDelivery.delivery_lat, lng: selectedDelivery.delivery_lng } : null;

            if (start && end) {
                try {
                    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
                    const data = await response.json();

                    if (data.routes && data.routes.length > 0) {
                        const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                        routeLayerRef.current = L.polyline(coordinates, { color: '#3b82f6', weight: 6, opacity: 0.8, lineCap: 'round' }).addTo(mapRef.current);
                        mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });
                    }
                } catch (error) {
                    console.error('Erro ao buscar rota:', error);
                    routeLayerRef.current = L.polyline([[start.lat, start.lng], [end.lat, end.lng]], { color: '#3b82f6', weight: 4, dashArray: '10, 10', opacity: 0.5 }).addTo(mapRef.current);
                }
            }
        };

        drawRoute();
    }, [selectedDelivery]);

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
        <div className={`${isEmbedded ? 'w-full h-full relative' : 'fixed inset-0 z-[200] bg-black'} animate-in fade-in duration-300 flex flex-col`}>
            {/* Header */}
            <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto">
                    <div className="bg-zinc-950/80 backdrop-blur-md p-3 rounded-2xl border border-zinc-800 shadow-xl">
                        <h2 className="text-white font-black text-sm uppercase tracking-tighter flex items-center gap-2">
                            <MapPin className="text-emerald-500" size={16} />
                            Entregas Próximas
                        </h2>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">
                            {deliveries.length} Disponíveis (Raio 30km)
                        </p>
                    </div>
                    {userCoords && (
                        <button
                            onClick={handleRecenter}
                            className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-xl border border-blue-400/20 transition-all active:scale-95"
                            title="Recentralizar Mapa"
                        >
                            <Navigation2 size={18} fill="white" />
                        </button>
                    )}
                </div>
                {!isEmbedded && (
                    <button
                        onClick={onClose}
                        className="pointer-events-auto w-10 h-10 bg-zinc-950/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-zinc-800 shadow-xl hover:bg-zinc-800 transition-all"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            <div className="flex-1 relative z-0">
                <div ref={mapContainerRef} className="w-full h-full bg-zinc-900" />

                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 p-3 rounded-2xl shadow-2xl z-[100] space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Package size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] sm:text-xs text-zinc-300 font-black uppercase tracking-widest">Coleta</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20">
                            <MapPin size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] sm:text-xs text-zinc-300 font-black uppercase tracking-widest">Entrega</span>
                    </div>
                </div>

                {!userCoords ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md z-[500]">
                        <div className="text-center space-y-4 p-6">
                            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto relative">
                                <Navigation2 className="text-blue-500 animate-bounce" size={40} />
                                <div className="absolute inset-0 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                            <h3 className="text-white font-black text-xl uppercase tracking-tighter">Sintonizando Satélites...</h3>
                            <p className="text-zinc-500 text-sm max-w-xs mx-auto font-bold leading-relaxed">
                                Precisamos da sua localização precisa para mostrar as entregas num raio de <span className="text-blue-400">30km</span>.
                            </p>
                        </div>
                    </div>
                ) : deliveries.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm z-[10]">
                        <div className="text-center space-y-4">
                            <Truck className="w-16 h-16 text-zinc-700 mx-auto" />
                            <p className="text-zinc-400 font-bold text-sm">Nenhuma entrega disponível no momento</p>
                        </div>
                    </div>
                )}
            </div>

            {selectedDelivery && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] animate-in fade-in duration-200" onClick={() => setSelectedDelivery(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-zinc-800 flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                {selectedDelivery.image_url ? (
                                    <img src={selectedDelivery.image_url} alt={selectedDelivery.item_title} className="w-16 h-16 rounded-xl object-cover border border-zinc-800" />
                                ) : (
                                    <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center"><Package className="text-zinc-600" size={24} /></div>
                                )}
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-base line-clamp-2">{selectedDelivery.item_title}</h3>
                                    <p className="text-primary-400 font-black text-xl mt-1">{formatCurrency(selectedDelivery.delivery_fee)}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDelivery(null)} className="p-2 hover:bg-zinc-800 rounded-lg transition"><X className="text-zinc-500" size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin size={16} className="text-amber-500" />
                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Ponto de Coleta</span>
                                </div>
                                <p className="text-white text-sm font-medium mb-2">{correctStoredAddress(selectedDelivery.pickup_lat, selectedDelivery.pickup_lng, selectedDelivery.pickup_address)}</p>
                                <div className="flex items-center gap-2 text-zinc-400 text-xs"><User size={14} /><span>{selectedDelivery.seller_name}</span></div>
                            </div>

                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin size={16} className="text-emerald-500" />
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Ponto de Entrega</span>
                                </div>
                                <p className="text-white text-sm font-medium mb-2">{correctStoredAddress(selectedDelivery.delivery_lat, selectedDelivery.delivery_lng, selectedDelivery.delivery_address)}</p>
                                <div className="flex items-center gap-2 text-zinc-400 text-xs"><User size={14} /><span>{selectedDelivery.buyer_name}</span></div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { onIgnore(selectedDelivery.id); setSelectedDelivery(null); }} className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl font-bold text-sm transition">Ignorar</button>
                                <button onClick={handleAcceptDelivery} disabled={isAccepting} className="flex-1 py-3 bg-primary-500 hover:bg-primary-400 text-black rounded-xl font-black text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {isAccepting ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><Truck size={18} />ACEITAR ENTREGA</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
