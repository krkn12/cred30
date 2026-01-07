import React from 'react';
import { MetricCard } from '../../components/ui/MetricCard';
import { User, Quota, Loan } from '../../../domain/types/common.types';

interface ClientDashboardProps {
  user: User;
  quotas: Quota[];
  loans: Loan[];
  onDeposit: () => void;
  onWithdraw: () => void;
  onBuyQuota: () => void;
  onSellQuota: () => void;
  onRequestLoan: () => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({
  user,
  quotas,
  loans,
  onDeposit,
  onWithdraw,
  onBuyQuota,
  onSellQuota,
  onRequestLoan
}) => {
  const totalQuotaValue = quotas.reduce((sum, quota) => sum + quota.currentValue, 0);
  const totalQuotaProfit = quotas.reduce((sum, quota) => sum + (quota.currentValue - quota.purchasePrice), 0);
  const activeLoans = loans.filter(loan => loan.status === 'APPROVED' || loan.status === 'PAYMENT_PENDING');
  const pendingLoans = loans.filter(loan => loan.status === 'PENDING');
  const totalLoanDebt = activeLoans.reduce((sum, loan) => sum + (loan.remainingAmount || loan.totalRepayment), 0);

  // Helper formatting (injected or local)
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPercent = (val: number) => (val * 100).toFixed(2) + '%';

  const netWorth = user.balance + totalQuotaValue - totalLoanDebt;

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Olá, {user.name}!</h2>
        <p className="text-blue-100">Seu patrimônio líquido total</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(netWorth)}</p>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Saldo Disponível"
          value={formatCurrency(user.balance)}
          subtitle="Para resgates ou novos aportes"
          color="blue"
        />
        <MetricCard
          title="Valor em Licenças"
          value={formatCurrency(totalQuotaValue)}
          subtitle={`${quotas.length} licença(s)`}
          color="green"
          trend={totalQuotaProfit !== 0 ? {
            value: Math.abs((totalQuotaProfit / (totalQuotaValue - totalQuotaProfit)) * 100),
            isPositive: totalQuotaProfit > 0
          } : undefined}
        />
        <MetricCard
          title="Compromissos Ativos"
          value={formatCurrency(totalLoanDebt)}
          subtitle={`${activeLoans.length} apoio(s) em aberto`}
          color="red"
        />
        <MetricCard
          title="Excedentes das Licenças"
          value={formatCurrency(totalQuotaProfit)}
          subtitle={totalQuotaProfit >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
          color={totalQuotaProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Ações Rápidas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <button
            onClick={onDeposit}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mb-2">
              +
            </div>
            <span className="text-sm font-medium text-gray-900">Depositar</span>
          </button>

          <button
            onClick={onWithdraw}
            className="flex flex-col items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold mb-2">
              -
            </div>
            <span className="text-sm font-medium text-gray-900">Resgatar</span>
          </button>

          <button
            onClick={onBuyQuota}
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold mb-2">
              ↑
            </div>
            <span className="text-sm font-medium text-gray-900">Aportar Licenças</span>
          </button>

          <button
            onClick={onSellQuota}
            disabled={quotas.length === 0}
            className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold mb-2">
              ↓
            </div>
            <span className="text-sm font-medium text-gray-900">Resgatar Licença</span>
          </button>

          <button
            onClick={onRequestLoan}
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mb-2">
              ₿
            </div>
            <span className="text-sm font-medium text-gray-900">Pedir Apoio</span>
          </button>

          <button
            className="flex flex-col items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold mb-2">
              📊
            </div>
            <span className="text-sm font-medium text-gray-900">Ver Relatórios</span>
          </button>
        </div>
      </div>

      {/* Resumo de Aportes e Apoio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Minhas Licenças</h3>
          {quotas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">Você ainda não possui licenças</p>
              <button
                onClick={onBuyQuota}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Adquirir Primeira Licença
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {quotas.map((quota, index) => (
                <div key={quota.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">Licença #{index + 1}</p>
                      <p className="text-sm text-gray-500">
                        Comprada em {new Date(quota.purchaseDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(quota.currentValue)}
                      </p>
                      <p className={`text-sm ${quota.currentValue >= quota.purchasePrice ? 'text-green-600' : 'text-red-600'}`}>
                        {quota.currentValue >= quota.purchasePrice ? '+' : ''}
                        {formatPercent((quota.currentValue - quota.purchasePrice) / quota.purchasePrice)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Meus Apoios Mútuos</h3>
          {loans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">Você ainda não solicitou apoios</p>
              <button
                onClick={onRequestLoan}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Solicitar Apoio Mútuo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingLoans.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Você tem {pendingLoans.length} apoio(s) mútuo(s) pendente(s) de aprovação
                  </p>
                </div>
              )}
              {loans.slice(0, 3).map((loan) => (
                <div key={loan.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(loan.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {loan.installments}x • {new Date(loan.requestDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${loan.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        loan.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          loan.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                            loan.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                        }`}>
                        {loan.status === 'APPROVED' ? 'Aprovado' :
                          loan.status === 'PENDING' ? 'Pendente' :
                            loan.status === 'REJECTED' ? 'Rejeitado' :
                              loan.status === 'PAID' ? 'Pago' : loan.status}
                      </span>
                      {loan.remainingAmount !== undefined && loan.remainingAmount < loan.totalRepayment && (
                        <p className="text-sm text-green-600 mt-1">
                          {formatCurrency(loan.remainingAmount)} restantes
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loans.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  E mais {loans.length - 3} apoio(s) mútuo(s)...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};