import {
    Bike,
    Car,
    Truck,
    LayoutGrid,
    Ticket,
    Smartphone,
    Home,
    Wrench,
    Shirt,
    Package,
    Zap // Usado como fallback para motor de busca de ícones se necessário
} from 'lucide-react';

export const VEHICLE_ICONS: Record<string, any> = {
    'BIKE': Bike,
    'MOTO': Bike, // Mantendo Lucide consistentemente, o 'Zap' ou 'Bike' são mais estáveis no build
    'CAR': Car,
    'TRUCK': Truck
};

export const DELIVERY_MIN_FEES: Record<string, number> = {
    'BIKE': 5.00,
    'MOTO': 10.00,
    'CAR': 30.00,
    'TRUCK': 80.00
};

export const CATEGORY_ICONS: Record<string, any> = {
    'TODOS': LayoutGrid,
    'PARTICIPAÇÕES': Ticket,
    'ELETRÔNICOS': Smartphone,
    'VEÍCULOS': Car,
    'IMÓVEIS': Home,
    'SERVIÇOS': Wrench,
    'MODA': Shirt,
    'OUTROS': Package
};

export const MARKETPLACE_CATEGORIES = [
    'PARTICIPAÇÕES',
    'ELETRÔNICOS',
    'VEÍCULOS',
    'IMÓVEIS',
    'SERVIÇOS',
    'MODA',
    'OUTROS'
];
