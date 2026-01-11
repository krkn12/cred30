/**
 * Utilitário de correção cirúrgica de geolocalização.
 * Resolve problemas onde APIs públicas (como Nominatim/OSM) retornam nomes de ruas errados
 * em áreas de mapeamento impreciso em Belém/PA.
 */

interface AddressData {
    neighborhood: string;
    city: string;
    state: string;
    accuracy?: number;
}

/**
 * Calcula a distância em metros entre dois pontos (Haversine simplified for small distances)
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Configuração de regras de correção
const CORRECTION_RULES = [
    {
        // Regra do Josias (Tapanã/Pratinha)
        targetLat: -1.365851,
        targetLng: -48.475922,
        radius: 600, // 600 metros de raio para cobrir oscilações de GPS
        correction: {
            neighborhood: "Passagem Dois Amigos, 1494 - Pratinha",
            city: "Belém",
            state: "PA"
        },
        triggers: ["Lula", "Presidente Lula", "Tapanã"] // Palavras que ativam a correção se encontradas no bairro original
    }
];

export function applyLocationCorrection(lat: number, lng: number, currentAddress: AddressData): AddressData {
    for (const rule of CORRECTION_RULES) {
        const dist = getDistance(lat, lng, rule.targetLat, rule.targetLng);

        if (dist <= rule.radius) {
            const needsCorrection = rule.triggers.some(t =>
                currentAddress.neighborhood.toLowerCase().includes(t.toLowerCase())
            );

            if (needsCorrection || !currentAddress.neighborhood) {
                console.log(`[GEO-FIX] Aplicando correção cirúrgica para: ${rule.correction.neighborhood}`);
                return {
                    ...currentAddress,
                    ...rule.correction
                };
            }
        }
    }

    return currentAddress;
}

export function correctStoredAddress(lat: number | null, lng: number | null, address: string): string {
    if (lat === null || lng === null) return address;

    for (const rule of CORRECTION_RULES) {
        const dist = getDistance(lat, lng, rule.targetLat, rule.targetLng);

        if (dist <= rule.radius) {
            const hasTrigger = rule.triggers.some(t => address.toLowerCase().includes(t.toLowerCase()));

            // Se o endereço original contém os termos errados OU se for uma string curta/vazia
            if (hasTrigger || address.length < 5) {
                console.log(`[GEO-FIX] Substituindo endereço armazenado equivocado por: ${rule.correction.neighborhood}`);
                return `${rule.correction.neighborhood}, ${rule.correction.city} - ${rule.correction.state}`;
            }
        }
    }

    return address;
}
