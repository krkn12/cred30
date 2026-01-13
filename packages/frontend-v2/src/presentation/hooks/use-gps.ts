import { useState, useCallback } from 'react';
import { applyLocationCorrection } from '../../application/utils/location_corrections';

interface GpsLocation {
    city: string;
    state: string;
    neighborhood: string;
    accuracy?: number;
    lat?: number;
    lng?: number;
}

export const useGps = (onSuccess?: (title: string, message: string) => void, onError?: (title: string, message: string) => void) => {
    const [isLoading, setIsLoading] = useState(false);

    const getLocation = useCallback(async (options: { highAccuracy?: boolean } = {}): Promise<GpsLocation | null> => {
        if (!navigator.geolocation) {
            onError?.('Erro', 'Geolocalização não suportada.');
            return null;
        }

        setIsLoading(true);

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(async (position) => {
                try {
                    const { latitude, longitude, accuracy } = position.coords;
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();

                    if (data.address) {
                        const stateName = data.address.state;
                        const cityName = data.address.city || data.address.town || data.address.municipality || '';
                        const neighborhood = data.address.suburb || data.address.neighbourhood || '';

                        // Tentativa simples de extrair sigla se for nome completo (Fallback)
                        const rawAddress = {
                            city: cityName,
                            state: stateName || '',
                            neighborhood: neighborhood,
                            accuracy: accuracy,
                            lat: latitude,
                            lng: longitude
                        };

                        const corrected = applyLocationCorrection(latitude, longitude, rawAddress);

                        onSuccess?.('Localização Definida', `${corrected.neighborhood ? corrected.neighborhood + ' - ' : ''}${corrected.city}/${corrected.state}`);
                        resolve(corrected);
                    } else {
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Erro ao buscar endereço GPS:', error);
                    onError?.('Erro', 'Falha ao buscar endereço GPS.');
                    resolve(null);
                } finally {
                    setIsLoading(false);
                }
            }, (err) => {
                console.warn(err);
                setIsLoading(false);
                onError?.('Erro no GPS', 'Verifique se a permissão de localização está ativa.');
                resolve(null);
            }, {
                enableHighAccuracy: options.highAccuracy || false,
                timeout: 10000
            });
        });
    }, [onSuccess, onError]);

    return {
        getLocation,
        isLoading
    };
};
