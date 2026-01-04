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
    const [destCoords, setDestCoords] = useState<{ lat: number, lng: number } | null>(null);

    const getCourierIcon = (vehicleType: string = 'MOTORCYCLE') => {
        let svg = '';
        switch (vehicleType) {
            case 'BICYCLE':
                svg = `<path d="M5.5 17.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zm13 0c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zm-5.5-1c0-2-1.5-3.5-3.5-3.5h-1l-2.5-3.5h5l1.5-2h2.5" /><path d="M12 17.5v-3.5" /><path d="M18.5 15l-3.5-3.5" />`;
                break;
            case 'CAR':
                svg = `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.2-1.4.7l-1.5 2.6c-.1.2-.1.4-.1.7V16c0 .6.4 1 1 1h2m10 0h-4" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />`;
                break;
            case 'VAN':
            case 'TRUCK':
                svg = `<path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2" /><path d="M17 9h4l2 3v4a2 2 0 0 1-2 2h-1" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />`;
                break;
            default: // MOTORCYCLE
                svg = `<path d="M5.5 17.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zm13 0c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zm-5.5.5V9l3 3" /><path d="M6.5 10l2-2.5H12" />`;
        }

        return L.divIcon({
            html: `<div class="bg-indigo-600 p-2 rounded-full shadow-lg border-2 border-white animate-pulse">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5">
                        ${svg}
                    </svg>
                  </div>`,
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    };

    const destinationIcon = L.divIcon({
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

        // Polling para o comprador ver o motorista
        let interval: any;
        if (userRole !== 'courier') {
            interval = setInterval(async () => {
                try {
                    const res = await apiService.get<any>(`/marketplace/order/${orderId}/tracking`);
                    if (res.success && res.data.courier_lat) {
                        updateCourierMarker(res.data.courier_lat, res.data.courier_lng, res.data.courier_vehicle_type);
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
                    updateCourierMarker(latitude, longitude, trackingData?.courier_vehicle_type);
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

    const initMap = async (data: any) => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Ponto central inicial (ou a posição do entregador, ou Belem como fallback)
        const initialLat = data.courier_lat || -1.4558;
        const initialLng = data.courier_lng || -48.4902;

        mapRef.current = L.map(mapContainerRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView([initialLat, initialLng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(mapRef.current);

        // Tentar geocodificar o destino e origem
        const points: L.LatLngExpression[] = [];

        if (data.delivery_address) {
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(data.delivery_address)}&limit=1`);
                const geoData = await geoRes.json();
                if (geoData && geoData.length > 0) {
                    const destLat = parseFloat(geoData[0].lat);
                    const destLng = parseFloat(geoData[0].lon);
                    setDestCoords({ lat: destLat, lng: destLng });
                    L.marker([destLat, destLng], { icon: destinationIcon })
                        .addTo(mapRef.current)
                        .bindPopup('Entrega');
                    points.push([destLat, destLng]);
                }
            } catch (err) { console.error('Dest geocode error', err); }
        }

        if (data.pickup_address) {
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(data.pickup_address)}&limit=1`);
                const geoData = await geoRes.json();
                if (geoData && geoData.length > 0) {
                    const pickLat = parseFloat(geoData[0].lat);
                    const pickLng = parseFloat(geoData[0].lon);
                    L.marker([pickLat, pickLng], {
                        icon: L.divIcon({
                            html: `<div class="bg-amber-500 p-2 rounded-full shadow-lg border-2 border-white"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg></div>`,
                            className: '', iconSize: [32, 32], iconAnchor: [16, 16]
                        })
                    }).addTo(mapRef.current).bindPopup('Retirada');
                    points.push([pickLat, pickLng]);
                }
            } catch (err) { console.error('Pick geocode error', err); }
        }

        if (data.courier_lat) {
            courierMarkerRef.current = L.marker([data.courier_lat, data.courier_lng], { icon: getCourierIcon(data.courier_vehicle_type) })
                .addTo(mapRef.current);
            points.push([data.courier_lat, data.courier_lng]);
        }

        if (points.length > 1) {
            mapRef.current.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
        } else if (points.length === 1) {
            mapRef.current.setView(points[0], 15);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    const deg2rad = (deg: number) => deg * (Math.PI / 180);

    const updateCourierMarker = (lat: number, lng: number, vehicleType?: string) => {
        if (!mapRef.current) return;

        if (courierMarkerRef.current) {
            courierMarkerRef.current.setLatLng([lat, lng]);
            if (vehicleType) courierMarkerRef.current.setIcon(getCourierIcon(vehicleType));
        } else {
            courierMarkerRef.current = L.marker([lat, lng], { icon: getCourierIcon(vehicleType) })
                .addTo(mapRef.current);
        }

        // Se tivermos os dados de tracking, recalcular distância se necessário
        // (Isso será refletido no render automaticamente via trackingData se fosse um state, 
        // mas aqui trackingData é estático do primeiro fetch, o polling atualiza o marcador).
        // Para simplificar, o polling de tracking já traz a posição.

        mapRef.current.panTo([lat, lng], { animate: true });
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
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Entregador ({trackingData.courier_vehicle_type})</p>
                                <p className="text-base font-black text-white">{trackingData.courier_name}</p>
                            </div>
                        </div>
                        {trackingData.courier_lat && (
                            <div className="text-right">
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Distância</p>
                                <p className="text-base font-black text-primary-400">
                                    ~{calculateDistance(trackingData.courier_lat, trackingData.courier_lng, destCoords?.lat || -1.4558, destCoords?.lng || -48.4902).toFixed(1)} km
                                </p>
                            </div>
                        )}
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
