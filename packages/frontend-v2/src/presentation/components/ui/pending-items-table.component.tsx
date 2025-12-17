import React from 'react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { STATUS_BADGES, TRANSACTION_TYPES } from '../../utils/constants';

interface PendingItem {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: number;
  userId: string;
  userName?: string;
  userEmail?: string;
  pixKeyToReceive?: string;
  totalRepayment?: number;
  installments?: number;
  metadata?: any;
}

interface PendingItemsTableProps {
  title: string;
  items: PendingItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onFixPix?: (id: string) => void;
  type: 'transactions' | 'loans';
}

export const PendingItemsTable: React.FC<PendingItemsTableProps> = ({
  title,
  items,
  onApprove,
  onReject,
  onFixPix,
  type
}) => {
  const getTransactionDescription = (item: PendingItem) => {
    switch (item.type) {
      case TRANSACTION_TYPES.WITHDRAWAL:
        return `Saque de ${formatCurrency(item.amount)}`;
      case TRANSACTION_TYPES.BUY_QUOTA:
        return `Compra de ${item.metadata?.quotaCount || 1} cota(s)`;
      case TRANSACTION_TYPES.SELL_QUOTA:
        return `Venda de ${item.metadata?.quotaCount || 1} cota(s)`;
      default:
        return `${item.type} - ${formatCurrency(item.amount)}`;
    }
  };

  const getLoanDescription = (item: PendingItem) => {
    return (
      <div>
        <div className="font-medium">Empréstimo de {formatCurrency(item.amount)}</div>
        <div className="text-sm text-gray-500">
          {item.installments}x de {formatCurrency((item.totalRepayment || 0) / (item.installments || 1))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">
          {items.length} item{items.length !== 1 ? 's' : ''} pendente{items.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descrição
              </th>
              {type === 'loans' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PIX Destino
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={type === 'loans' ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                  Nenhum item pendente encontrado
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.userName || 'Nome não disponível'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.userEmail || 'Email não disponível'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {type === 'transactions' ? getTransactionDescription(item) : getLoanDescription(item)}
                  </td>
                  {type === 'loans' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {item.pixKeyToReceive || 'Não informado'}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_BADGES[item.status as keyof typeof STATUS_BADGES] || 'bg-gray-100 text-gray-800'}`}>
                      {item.status === 'PENDING' ? 'Pendente' : 
                       item.status === 'APPROVED' ? 'Aprovado' : 
                       item.status === 'REJECTED' ? 'Rejeitado' : item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onApprove(item.id)}
                        className="text-green-600 hover:text-green-900 font-medium"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => onReject(item.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Rejeitar
                      </button>
                      {type === 'loans' && onFixPix && (
                        <button
                          onClick={() => onFixPix(item.id)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Corrigir PIX
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};