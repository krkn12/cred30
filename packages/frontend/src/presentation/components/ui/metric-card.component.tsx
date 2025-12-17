import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  color = 'blue',
  size = 'md'
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900'
  };

  const valueColorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600'
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div className={`border rounded-lg ${sizeClasses[size]} ${colorClasses[color]} transition-all hover:shadow-md`}>
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className={`text-2xl font-bold ${valueColorClasses[color]} mb-1`}>
        {value}
      </div>
      {subtitle && (
        <p className="text-sm text-gray-600">{subtitle}</p>
      )}
      {trend && (
        <div className={`flex items-center mt-2 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          <span className="mr-1">
            {trend.isPositive ? '↑' : '↓'}
          </span>
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </div>
  );
};