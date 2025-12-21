import React from 'react';

interface MetricCardProps {
    title: string;
    value: string;
    subtitle: string;
    color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

const colorStyles = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
    green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
    red: 'bg-red-500/10 border-red-500/20 text-red-500',
};

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, color, trend }) => {
    return (
        <div className={`p-6 rounded-2xl border ${colorStyles[color]} transition hover:scale-[1.02]`}>
            <h3 className="text-sm font-medium mb-1 opacity-80">{title}</h3>
            <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold mb-1">{value}</p>
                {trend && (
                    <span className={`text-[10px] font-bold ${trend.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {trend.isPositive ? '↑' : '↓'} {trend.value.toFixed(1)}%
                    </span>
                )}
            </div>
            <p className="text-xs opacity-60">{subtitle}</p>
        </div>
    );
};
