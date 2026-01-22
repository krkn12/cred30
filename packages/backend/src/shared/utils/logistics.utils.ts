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

    // Normalizar CEPs (apenas números)
    const origin = originCep.replace(/\D/g, '');
    const dest = destCep.replace(/\D/g, '');

    // 1. Mesmo Bairro/Cidade (Mesmos 5 primeiros dígitos) -> Entregador Local
    if (origin.substring(0, 4) === dest.substring(0, 4)) {
        return {
            fee: 15.00, // Preço fixo base para entrega local (pode ser ajustado por KM se houver lat/lng)
            deliveryEstimateDays: 1,
            method: 'COURIER'
        };
    }

    // 2. Mesmo Estado (Mesmo primeiro dígito ou conforme faixa estadual)
    // No Brasil, o primeiro dígito define a região postal (ex: 0 e 1 = SP)
    const originRegion = origin.substring(0, 1);
    const destRegion = dest.substring(0, 1);

    if (originRegion === destRegion) {
        return {
            fee: 35.00 + (Math.floor(weightGrams / 1000) * 5),
            deliveryEstimateDays: 3,
            method: 'STATE'
        };
    }

    // 3. Regiões Próximas (ex: Sudeste 0-3, Sul 8-9)
    const isSudeste = (c: string) => ['0', '1', '2', '3'].includes(c[0]);
    if (isSudeste(origin) && isSudeste(dest)) {
        return {
            fee: 45.00 + (Math.floor(weightGrams / 1000) * 7),
            deliveryEstimateDays: 5,
            method: 'REGIONAL'
        };
    }

    // 4. Nacional (Brasil Todo)
    return {
        fee: 65.00 + (Math.floor(weightGrams / 1000) * 10),
        deliveryEstimateDays: 10,
        method: 'NATIONAL'
    };
}
