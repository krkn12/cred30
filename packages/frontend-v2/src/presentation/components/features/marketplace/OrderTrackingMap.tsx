import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Truck, Navigation2, X, Target, MousePointer2 } from 'lucide-react';
import { apiService } from '../../../../application/services/api.service';
import { correctStoredAddress } from '../../../../application/utils/location_corrections';
import { useWakeLock } from '../../../hooks/use-wake-lock';

interface OrderTrackingMapProps {
    orderId: string;
    onClose: () => void;
    userRole: 'buyer' | 'courier' | 'seller';
    embedded?: boolean;
}

export const OrderTrackingMap: React.FC<OrderTrackingMapProps> = ({ orderId, onClose, userRole, embedded = false }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const courierMarkerRef = useRef<L.Marker | null>(null);
    const courierAccuracyCircleRef = useRef<L.Circle | null>(null);
    const [trackingData, setTrackingData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [courierPos, setCourierPos] = useState<{ lat: number, lng: number } | null>(null);
    const [destinationPos, setDestinationPos] = useState<{ lat: number, lng: number } | null>(null);
    const [isManualMode, setIsManualMode] = useState(false); // New state for manual override
    useWakeLock();
    const routeLayerRef = useRef<L.Polyline | null>(null);

    // Ícones personalizados
    const courierIcon = L.divIcon({
        html: `<div class="relative w-12 h-12 flex items-center justify-center">
                <div class="absolute inset-0 bg-blue-500/30 animate-ping rounded-full"></div>
                <div class="relative z-10 bg-blue-600 p-2 rounded-full shadow-lg border-2 border-white transform hover:scale-110 transition-transform cursor-move">
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

    const updateCourierMarker = (lat: number, lng: number, accuracy?: number) => {
        setCourierPos({ lat, lng });
        if (!mapRef.current) return;

        // Atualiza Marcador
        if (courierMarkerRef.current) {
            courierMarkerRef.current.setLatLng([lat, lng]);
        } else {
            const marker = L.marker([lat, lng], {
                icon: courierIcon,
                draggable: userRole === 'courier' // Apenas entregador pode arrastar
            }).addTo(mapRef.current);

            // Evento de Drag End
            marker.on('dragend', async (event) => {
                const newPos = event.target.getLatLng();
                setIsManualMode(true); // Ativa modo manual
                setCourierPos({ lat: newPos.lat, lng: newPos.lng });

                // Remove círculo de precisão pois manual é exato (pelo usuário)
                if (courierAccuracyCircleRef.current) {
                    courierAccuracyCircleRef.current.remove();
                    courierAccuracyCircleRef.current = null;
                }

                try {
                    await apiService.post(`/marketplace/logistic/mission/${orderId}/location`, { lat: newPos.lat, lng: newPos.lng });
                } catch (e) {
                    console.error('Erro ao atualizar posição manual', e);
                }
            });

            courierMarkerRef.current = marker;
        }

        // Atualiza Círculo de Precisão (apenas se não estiver em modo manual ou se accuracy for fornecida explicitamente na chamada)
        if (accuracy && !isManualMode) {
            if (courierAccuracyCircleRef.current) {
                courierAccuracyCircleRef.current.setLatLng([lat, lng]);
                courierAccuracyCircleRef.current.setRadius(accuracy);
            } else {
                courierAccuracyCircleRef.current = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.15,
                    weight: 1
                }).addTo(mapRef.current);
            }
        }

        if (!isManualMode) {
            mapRef.current.panTo([lat, lng], { animate: true, duration: 1.0 });
        }
    };

    const reenableAutoGPS = () => {
        setIsManualMode(false);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;
                    updateCourierMarker(latitude, longitude, accuracy);
                    if (mapRef.current) {
                        mapRef.current.setView([latitude, longitude], 16, { animate: true });
                    }
                },
                (err) => console.error(err),
                { enableHighAccuracy: true }
            );
        }
    };

    const initMap = async (data: any) => {
        if (!mapContainerRef.current || mapRef.current) return;

        let initialCourierLat = data.courier_lat;
        let initialCourierLng = data.courier_lng;

        if (!initialCourierLat && userRole === 'courier' && navigator.geolocation) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                });
                initialCourierLat = position.coords.latitude;
                initialCourierLng = position.coords.longitude;
                // Inicializa com precisão se disponível
                updateCourierMarker(initialCourierLat, initialCourierLng, position.coords.accuracy);
            } catch (e) {
                initialCourierLat = -1.4558;
                initialCourierLng = -48.4902;
            }
        }

        const mapCenter = initialCourierLat || -1.4558;
        const mapCenterLng = initialCourierLng || -48.4902;

        mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([mapCenter, mapCenterLng], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20 }).addTo(mapRef.current);

        if (initialCourierLat && initialCourierLng && !courierMarkerRef.current) {
            // Se já não foi criado pelo getCurrentPosition acima
            updateCourierMarker(initialCourierLat, initialCourierLng);
        }

        const isInTransit = data.delivery_status === 'IN_TRANSIT' || data.status === 'IN_TRANSIT';
        let destLat = isInTransit ? (data.delivery_lat ? parseFloat(data.delivery_lat) : null) : (data.pickup_lat ? parseFloat(data.pickup_lat) : null);
        let destLng = isInTransit ? (data.delivery_lng ? parseFloat(data.delivery_lng) : null) : (data.pickup_lng ? parseFloat(data.pickup_lng) : null);
        const targetIcon = isInTransit ? destinationIcon : pickupIcon;

        if (!destLat || !destLng) {
            const targetAddress = isInTransit ? data.delivery_address : data.pickup_address;
            if (targetAddress) {
                try {
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(targetAddress)}&limit=1`);
                    const geoData = await geoRes.json();
                    if (geoData && geoData.length > 0) {
                        destLat = parseFloat(geoData[0].lat);
                        destLng = parseFloat(geoData[0].lon);
                    }
                } catch (err) {
                    console.error('Geocoding error:', err);
                }
            }
        }

        if (destLat && destLng) {
            setDestinationPos({ lat: destLat, lng: destLng });
            L.marker([destLat, destLng], { icon: targetIcon }).addTo(mapRef.current).bindPopup(isInTransit ? 'Entrega' : 'Coleta');
            if (initialCourierLat && initialCourierLng) {
                const bounds = L.latLngBounds([initialCourierLat, initialCourierLng], [destLat, destLng]);
                mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            } else {
                mapRef.current.setView([destLat, destLng], 14);
            }
        }
    };

    useEffect(() => {
        const fetchTracking = async () => {
            try {
                const res = await apiService.get<any>(`/marketplace/order/${orderId}/tracking`);
                if (res.success) {
                    setTrackingData(res.data);
                    initMap(res.data);
                }
            } catch (error) {
                console.error('Fetch tracking error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTracking();

        let interval: any;
        if (userRole !== 'courier') {
            interval = setInterval(async () => {
                try {
                    const res = await apiService.get<any>(`/marketplace/order/${orderId}/tracking`);
                    if (res.success && res.data.courier_lat) {
                        updateCourierMarker(res.data.courier_lat, res.data.courier_lng);
                    }
                } catch (e) {
                    console.error('Poll tracking error:', e);
                }
            }, 4000); // 4 segundos para movimentos mais fluídos
        }

        let watchId: number;
        if (userRole === 'courier' && navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;

                    // Ignora leituras com precisão muito ruim (> 100m) para evitar pulos no mapa
                    if (accuracy > 100) return;

                    // SE ESTIVER EM MODO MANUAL, IGNORA O UPDATE DO MAPA (mas mantém o watch ativo se quiser reconectar rápido?)
                    // Na verdade, aqui a gente DEVE ignorar o updateCourierMarker se estiver em manual
                    if (isManualMode) return;

                    updateCourierMarker(latitude, longitude, accuracy);
                    try {
                        // Usa rota específica de logística que aceita status 'ACCEPTED' e 'IN_TRANSIT'
                        await apiService.post(`/marketplace/logistic/mission/${orderId}/location`, { lat: latitude, lng: longitude });
                    } catch (e) {
                        console.error('Location update error:', e);
                    }
                },
                (err) => console.error('GPS Error', err),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 10000
                }
            );
        }

        return () => {
            if (interval) clearInterval(interval);
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (mapRef.current) mapRef.current.remove();
        };
    }, [orderId, userRole, isManualMode]);

    useEffect(() => {
        const drawRoute = async () => {
            if (!mapRef.current || !courierPos || !destinationPos) return;
            if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
            try {
                const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${courierPos.lng},${courierPos.lat};${destinationPos.lng},${destinationPos.lat}?overview=full&geometries=geojson`);
                const data = await response.json();
                if (data.routes && data.routes.length > 0) {
                    const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                    routeLayerRef.current = L.polyline(coordinates, { color: '#3b82f6', weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(mapRef.current);
                }
            } catch (e) {
                routeLayerRef.current = L.polyline([[courierPos.lat, courierPos.lng], [destinationPos.lat, destinationPos.lng]], { color: '#3b82f6', weight: 4, dashArray: '10, 10', opacity: 0.6 }).addTo(mapRef.current);
            }
        };
        const timeoutId = setTimeout(drawRoute, 500);
        return () => clearTimeout(timeoutId);
    }, [courierPos, destinationPos]);

    return (
        <div className={`fixed inset-0 z-[150] bg-black animate-in fade-in duration-300 flex flex-col ${embedded ? 'absolute z-0 bg-transparent' : ''}`}>
            {!embedded && (
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
                    <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition"><X size={24} /></button>
                </div>
            )}

            <div className="flex-1 relative">
                <div ref={mapContainerRef} className="w-full h-full bg-zinc-900" />

                {/* Manual Mode / Recenter Control */}
                {userRole === 'courier' && (
                    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                        <button
                            onClick={reenableAutoGPS}
                            className={`p-3 rounded-full shadow-xl border border-white/10 transition-all ${!isManualMode ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        >
                            <Target size={24} />
                        </button>
                        {isManualMode && (
                            <div className="bg-amber-500 text-black text-[10px] font-bold px-2 py-1 rounded-md animate-bounce shadow-lg text-center absolute right-[110%] top-2 w-24">
                                GPS Manual
                            </div>
                        )}
                    </div>
                )}
                {/* Tip for PC users */}
                {userRole === 'courier' && !isManualMode && (
                    <div className="absolute bottom-24 left-0 right-0 z-[1000] flex justify-center pointer-events-none fade-out duration-1000 delay-5000">
                        <div className="bg-black/60 text-white text-xs px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2">
                            <MousePointer2 size={14} />
                            <span>Arraste o marcador para corrigir sua posição</span>
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center z-[10]">
                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Localizando...</p>
                        </div>
                    </div>
                )}
            </div>

            {(!embedded || userRole === 'courier') && !isLoading && trackingData && (
                <div className={`${embedded ? 'absolute bottom-0 left-0 right-0 z-[1000] p-4 bg-zinc-950/90' : 'p-6 bg-zinc-950'} border-t border-zinc-800 space-y-4`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800"><Truck className="text-indigo-400" size={24} /></div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Entregador</p>
                                <p className="text-base font-black text-white">{trackingData.courier_name}</p>
                            </div>
                        </div>
                        <a href={`tel:${trackingData.courier_phone}`} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black transition flex items-center gap-2">LIGAR</a>
                    </div>
                    <div className="bg-zinc-900/50 p-4 rounded-2xl space-y-2 border border-zinc-800">
                        <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-amber-500" />
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Origem:</span>
                            <span className="text-[11px] text-white font-medium">{correctStoredAddress(trackingData.pickup_lat, trackingData.pickup_lng, trackingData.pickup_address)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-emerald-500" />
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Destino:</span>
                            <span className="text-[11px] text-white font-medium">{correctStoredAddress(trackingData.delivery_lat, trackingData.delivery_lng, trackingData.delivery_address)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
