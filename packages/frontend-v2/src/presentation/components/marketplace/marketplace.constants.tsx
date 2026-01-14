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
    Package
} from 'lucide-react';

// Ícone de Moto customizado (Lucide não tem Motorcycle)
export const MotorcycleIcon = ({ size = 24, className = '' }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="5" cy="17" r="2.5" />
        <circle cx="19" cy="17" r="2.5" />
        <path d="M12 17h-7" />
        <path d="M16.5 17h-4.5" />
        <path d="M14.5 17l1-5h3.5l2 5" />
        <path d="M5.5 14l2-7h3l2.5 7" />
        <path d="M9.5 7l1-2h2" />
    </svg>
);

export const VEHICLE_ICONS: Record<string, any> = {
    'BIKE': Bike,
    'MOTO': MotorcycleIcon,
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
