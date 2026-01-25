/**
 * Motor de Logística do Cred30
 * Calcula fretes baseados em CEP e regras de proximidade
 */

export interface ShippingQuote {
    fee: number;
    deliveryEstimateDays: number;
    method: 'COURIER' | 'STATE' | 'REGIONAL' | 'NATIONAL';
}

export function calculateShippingQuote(
    originCep: string,
    destCep: string,
    weightGrams: number = 1000,
    isFreeShipping: boolean = false
): ShippingQuote {
    if (isFreeShipping) {
        return { fee: 0, deliveryEstimateDays: 7, method: 'NATIONAL' };
    }

    const origin = originCep.replace(/\D/g, '');
    const dest = destCep.replace(/\D/g, '');

    // Constantes de Preço (Estilo SEDEX Blindado - Preços de Teto)
    const BASE_LOCAL = 28.00;
    const BASE_ESTADUAL = 38.00;
    const BASE_NACIONAL_PROXIMO = 55.00; // Sul/Sudeste
    const BASE_NACIONAL_DISTANTE = 78.00; // Norte/Nordeste/C-O
    const WEIGHT_STEP = 8.00; // R$ por kg extra
    const SAFETY_MARGIN = 1.25; // +25% de margem contra prejuízos

    let baseFee = BASE_NACIONAL_DISTANTE;
    let days = 10;
    let method: any = 'NATIONAL';

    const originRegion = origin.substring(0, 1);
    const destRegion = dest.substring(0, 1);
    const originArea = origin.substring(0, 5);
    const destArea = dest.substring(0, 5);

    // 1. Mesmo Bairro/Cidade (5 dígitos)
    if (originArea === destArea) {
        baseFee = BASE_LOCAL;
        days = 1;
        method = 'COURIER';
    }
    // 2. Mesmo Estado
    else if (originRegion === destRegion) {
        baseFee = BASE_ESTADUAL;
        days = 3;
        method = 'STATE';
    }
    // 3. Regiões Próximas (Sul 8-9 e Sudeste 0-3)
    else {
        const isSouthOrSoutheast = (c: string) => ['0', '1', '2', '3', '8', '9'].includes(c[0]);
        if (isSouthOrSoutheast(origin) && isSouthOrSoutheast(dest)) {
            baseFee = BASE_NACIONAL_PROXIMO;
            days = 5;
            method = 'REGIONAL';
        } else {
            baseFee = BASE_NACIONAL_DISTANTE;
            days = 8;
            method = 'NATIONAL';
        }
    }

    // Acréscimo por Peso (Peso mínimo considerado 1kg)
    const weightKg = Math.max(1, Math.ceil(weightGrams / 1000));
    const weightExtra = (weightKg - 1) * WEIGHT_STEP;

    // Cálculo Final com Margem de Segurança
    const finalFee = (baseFee + weightExtra) * SAFETY_MARGIN;

    return {
        fee: parseFloat(finalFee.toFixed(2)),
        deliveryEstimateDays: days,
        method: method
    };
}
