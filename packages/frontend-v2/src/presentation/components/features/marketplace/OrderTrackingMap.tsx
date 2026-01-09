import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { apiService } from '../../../../application/services/api.service';
import { MapPin, Truck, Navigation2, X } from 'lucide-react';

interface OrderTrackingMapProps {
    orderId: string;
    onClose: () => void;
    userRole: 'buyer' | 'courier' | 'seller';
}

export const OrderTrackingMap: React.FC<OrderTrackingMapProps> = ({ orderId, onClose, userRole }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const courierMarkerRef = useRef<L.Marker | null>(null);
    const [trackingData, setTrackingData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Ícone de Motoqueiro Premium (SVG)
    const courierIcon = L.divIcon({
        html: `<div class="relative w-12 h-12 flex items-center justify-center">
                <div class="absolute inset-0 bg-blue-500/30 animate-ping rounded-full"></div>
                <div class="relative z-10 bg-blue-600 p-2 rounded-full shadow-lg border-2 border-white transform hover:scale-110 transition-transform">
                     <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/>
                        <path d="M2.5 17.5H5a2 2 0 0 0 1-1.5L8 9l4 1 2-3h3.5"/>
                        <path d="M14 6l-3 4-2.5-1M19 17.5V14l-4-6-3 4"/>
                        <circle cx="18.5" cy="6.5" r="2.5" fill="white"/>
                     </svg>
                </div>
              </div>`,
        className: 'bg-transparent',
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    // Ícone de COLETA (Vendedor) = SACOLA 🛍️
    const pickupIcon = L.divIcon({
        html: `<div class="relative w-10 h-10 flex items-center justify-center">
                <div class="absolute inset-0 bg-amber-500/30 animate-pulse rounded-full"></div>
                <div class="relative z-10 bg-amber-500 p-2 rounded-full shadow-lg border-2 border-white">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                </div>
              </div>`,
        className: 'bg-transparent',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    // Ícone de ENTREGA (Comprador) = BANDEIRA DE CHEGADA 🏁
    const destinationIcon = L.divIcon({
        html: `<div class="relative w-10 h-10 flex items-center justify-center">
                <div class="absolute inset-0 bg-emerald-500/30 animate-pulse rounded-full"></div>
                <div class="relative z-10 bg-emerald-500 p-2 rounded-full shadow-lg border-2 border-white">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                        <line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                </div>
              </div>`,
        className: 'bg-transparent',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    // Buscar dados iniciais e configurar rastreio
    useEffect(() => {
        const fetchTracking = async () => {
            try {
                const res = await apiService.get<any>(`/marketplace/order/${orderId}/tracking`);
                if (res.success) {
                    setTrackingData(res.data);
                    initMap(res.data);
                }
            } catch (error) {
                console.error('Erro ao carregar rastreio:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTracking();

        // Se for o entregador, forçar a pegada de GPS imediatamente para traçar a rota (mesmo parado)
        if (userRole === 'courier' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    // Atualiza estado local imediatamente para feedback visual
                    setCourierPos({ lat: latitude, lng: longitude });
                    // Envia para o servidor se necessário (opcional, foco aqui é UX local)
                },
                (err) => console.log('Erro GPS inicial', err),
                { enableHighAccuracy: true }
            );
        }

        // Polling para o comprador ver o motorista
        let interval: any;
        if (userRole !== 'courier') {
            interval = setInterval(async () => {
                try {
                    const res = await apiService.get<any>(`/marketplace/order/${orderId}/tracking`);
                    if (res.success && res.data.courier_lat) {
                        updateCourierMarker(res.data.courier_lat, res.data.courier_lng);
                    }
                } catch (e) {
                    console.error('Polling error', e);
                }
            }, 10000); // 10 segundos
        }

        // Se for o entregador, enviar posição
        let watchId: number;
        if (userRole === 'courier' && navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    updateCourierMarker(latitude, longitude);
                    try {
                        await apiService.post(`/marketplace/logistic/mission/${orderId}/location`, {
                            lat: latitude,
                            lng: longitude
                        });
                    } catch (e) {
                        console.error('Update location error', e);
                    }
                },
                (err) => console.error('GPS Error', err),
                { enableHighAccuracy: true }
            );
        }

        return () => {
            if (interval) clearInterval(interval);
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (mapRef.current) mapRef.current.remove();
        };
    }, [orderId, userRole]);

    const routeLayerRef = useRef<L.Polyline | null>(null);
    const [courierPos, setCourierPos] = useState<{ lat: number, lng: number } | null>(null);
    const [destinationPos, setDestinationPos] = useState<{ lat: number, lng: number } | null>(null);

    // Efeito para desenhar/atualizar a rota quando as posições mudam
    useEffect(() => {
        const drawRoute = async () => {
            if (!mapRef.current || !courierPos || !destinationPos) return;

            // Remove rota anterior
            if (routeLayerRef.current) {
                routeLayerRef.current.remove();
                routeLayerRef.current = null;
            }

            try {
                // Tenta OSRM
                const response = await fetch(
                    `https://router.project-osrm.org/route/v1/driving/${courierPos.lng},${courierPos.lat};${destinationPos.lng},${destinationPos.lat}?overview=full&geometries=geojson`
                );
                const data = await response.json();

                if (data.routes && data.routes.length > 0) {
                    const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);

                    routeLayerRef.current = L.polyline(coordinates, {
                        color: '#3b82f6',
                        weight: 6,
                        opacity: 0.9,
                        lineCap: 'round'
                    }).addTo(mapRef.current);
                } else {
                    throw new Error('No route found');
                }
            } catch (e) {
                // Fallback: Linha reta tracejada
                console.log('OSRM falhou, usando fallback linear');
                routeLayerRef.current = L.polyline(
                    [[courierPos.lat, courierPos.lng], [destinationPos.lat, destinationPos.lng]],
                    { color: '#3b82f6', weight: 4, dashArray: '10, 10', opacity: 0.6 }
                ).addTo(mapRef.current);
            }
        };

        const timeoutId = setTimeout(drawRoute, 500); // Debounce para não floodar a API
        return () => clearTimeout(timeoutId);
    }, [courierPos, destinationPos]);

    const initMap = async (data: any) => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Tentar pegar GPS imediatamente para ter a posição do entregador
        let initialCourierLat = data.courier_lat;
        let initialCourierLng = data.courier_lng;

        // Se não tem posição do backend, pegar do GPS local
        if (!initialCourierLat && userRole === 'courier' && navigator.geolocation) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000
                    });
                });
                initialCourierLat = position.coords.latitude;
                initialCourierLng = position.coords.longitude;
                console.log('[MAP] GPS Local obtido:', initialCourierLat, initialCourierLng);
            } catch (e) {
                console.log('[MAP] Não conseguiu GPS local, usando fallback Belém');
                initialCourierLat = -1.4558; // Fallback Belém
                initialCourierLng = -48.4902;
            }
        }

        const mapCenter = initialCourierLat || -1.4558;
        const mapCenterLng = initialCourierLng || -48.4902;

        mapRef.current = L.map(mapContainerRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView([mapCenter, mapCenterLng], 15);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 20
        }).addTo(mapRef.current);

        // Setar posição do entregador imediatamente
        if (initialCourierLat && initialCourierLng) {
            setCourierPos({ lat: initialCourierLat, lng: initialCourierLng });
            courierMarkerRef.current = L.marker([initialCourierLat, initialCourierLng], { icon: courierIcon })
                .addTo(mapRef.current)
                .bindPopup('Você está aqui');
        }

        // Configurar Ponto de Destino
        // Status ACCEPTED = ir até o PICKUP (vendedor) = ícone SACOLA
        // Status IN_TRANSIT = ir até o DELIVERY (comprador) = ícone BANDEIRA
        let destLat: number | null = null;
        let destLng: number | null = null;
        let targetIcon = pickupIcon; // Default: Sacola (coleta)

        const isInTransit = data.delivery_status === 'IN_TRANSIT' || data.status === 'IN_TRANSIT';

        if (isInTransit) {
            // Destino é o endereço de ENTREGA (comprador)
            destLat = data.delivery_lat ? parseFloat(data.delivery_lat) : null;
            destLng = data.delivery_lng ? parseFloat(data.delivery_lng) : null;
            targetIcon = destinationIcon; // Bandeira de chegada
            console.log('[MAP] Modo IN_TRANSIT - Destino: delivery (bandeira)', destLat, destLng);
        } else {
            // Destino é o endereço de COLETA (vendedor)
            destLat = data.pickup_lat ? parseFloat(data.pickup_lat) : null;
            destLng = data.pickup_lng ? parseFloat(data.pickup_lng) : null;
            targetIcon = pickupIcon; // Sacola
            console.log('[MAP] Modo ACCEPTED - Destino: pickup (sacola)', destLat, destLng);
        }

        // Se não temos coords, tentar geocode
        if (!destLat || !destLng) {
            const targetAddress = isInTransit ? data.delivery_address : data.pickup_address;
            if (targetAddress) {
                try {
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(targetAddress)}&limit=1`);
                    const geoData = await geoRes.json();
                    if (geoData && geoData.length > 0) {
                        destLat = parseFloat(geoData[0].lat);
                        destLng = parseFloat(geoData[0].lon);
                        console.log('[MAP] Geocode bem sucedido:', destLat, destLng);
                    }
                } catch (err) {
                    console.error('[MAP] Geocode falhou', err);
                }
            }
        }

        // Adicionar marcador do destino
        if (destLat && destLng) {
            setDestinationPos({ lat: destLat, lng: destLng });
            L.marker([destLat, destLng], { icon: targetIcon })
                .addTo(mapRef.current)
                .bindPopup(isInTransit ? 'Entrega' : 'Coleta');

            // Ajustar zoom para mostrar ambos os pontos
            if (initialCourierLat && initialCourierLng) {
                const bounds = L.latLngBounds(
                    [initialCourierLat, initialCourierLng],
                    [destLat, destLng]
                );
                mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            } else {
                mapRef.current.setView([destLat, destLng], 14);
            }
        }

        console.log('[MAP] Init completo - courierPos:', initialCourierLat, initialCourierLng, 'destPos:', destLat, destLng);
    };

    const updateCourierMarker = (lat: number, lng: number) => {
        setCourierPos({ lat, lng }); // Atualiza estado para disparar redesenho da rota

        if (!mapRef.current) return;

        if (courierMarkerRef.current) {
            courierMarkerRef.current.setLatLng([lat, lng]);
        } else {
            courierMarkerRef.current = L.marker([lat, lng], { icon: courierIcon })
                .addTo(mapRef.current);
        }

        // Seguir o motorista suavemente
        mapRef.current.panTo([lat, lng], { animate: true, duration: 1.0 });
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black animate-in fade-in duration-300 flex flex-col">
            {/* Header */}
            <div className="p-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/20">
                        <Navigation2 className="text-indigo-400 animate-pulse" size={20} />
                    </div>
                    <div>
                        <h2 className="text-white font-black text-sm uppercase tracking-tighter">Rastreio em Tempo Real</h2>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">Pedido #{orderId.toString().slice(-6)}</p>
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

                {isLoading && (
                    <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center z-[10]">
                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Localizando...</p>
                        </div>
                    </div>
                )}

                {!isLoading && !trackingData?.courier_lat && (
                    <div className="absolute bottom-6 left-6 right-6 z-[10]">
                        <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-4 rounded-2xl shadow-2xl">
                            <div className="flex items-center gap-3">
                                <Truck className="text-amber-500" />
                                <div>
                                    <p className="text-xs font-bold text-white">Aguardando sinal do entregador</p>
                                    <p className="text-[10px] text-zinc-500">O rastreio iniciará assim que o deslocamento começar.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Status */}
            {!isLoading && trackingData && (
                <div className="p-6 bg-zinc-950 border-t border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
                                <Truck className="text-indigo-400" size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Entregador</p>
                                <p className="text-base font-black text-white">{trackingData.courier_name}</p>
                            </div>
                        </div>
                        <a
                            href={`tel:${trackingData.courier_phone}`}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black transition flex items-center gap-2"
                        >
                            LIGAR
                        </a>
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-2xl space-y-2 border border-zinc-800">
                        <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-primary-500" />
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Destino:</span>
                            <span className="text-[11px] text-white font-medium">{trackingData.delivery_address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-zinc-700 rounded-full ml-1" />
                            <div className="w-1 h-1 bg-zinc-700 rounded-full ml-1" />
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-amber-500" />
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Origem:</span>
                            <span className="text-[11px] text-white font-medium">{trackingData.pickup_address}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
