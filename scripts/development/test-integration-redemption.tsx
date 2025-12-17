import React, { useState } from 'react';
import InvestmentRedemption from './components/InvestmentRedemption';

// Exemplo de como integrar o componente InvestmentRedemption em uma aplicação
const TestIntegration: React.FC = () => {
  const [showRedemption, setShowRedemption] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<any>(null);

  // Dados mockados de investimentos para demonstração
  const mockInvestments = [
    {
      id: 'inv_001',
      name: 'Cota de Investimento - A',
      currentValue: 5500,
      purchaseValue: 5000,
      purchaseDate: new Date('2023-01-15'),
      redemptionPenalty: 0.02,
      status: 'active'
    },
    {
      id: 'inv_002',
      name: 'Cota de Investimento - B',
      currentValue: 3200,
      purchaseValue: 3000,
      purchaseDate: new Date('2023-06-20'),
      redemptionPenalty: 0.02,
      status: 'active'
    },
    {
      id: 'inv_003',
      name: 'Cota de Investimento - C',
      currentValue: 8000,
      purchaseValue: 7500,
      purchaseDate: new Date('2022-08-10'),
      redemptionPenalty: 0.02,
      status: 'active'
    }
  ];

  const handleRedeem = (investment: any) => {
    setSelectedInvestment(investment);
    setShowRedemption(true);
  };

  const handleCloseRedemption = () => {
    setShowRedemption(false);
    setSelectedInvestment(null);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  if (showRedemption && selectedInvestment) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <button
            onClick={handleCloseRedemption}
            style={{
              background: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              marginBottom: '2rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              color: '#667eea',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            ← Voltar para Investimentos
          </button>
          
          <InvestmentRedemption />
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', color: 'white', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            Meus Investimentos
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
            Selecione um investimento para resgatar
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {mockInvestments.map((investment) => {
            const yieldPercentage = ((investment.currentValue - investment.purchaseValue) / investment.purchaseValue) * 100;
            const elapsedDays = Math.ceil((new Date().getTime() - investment.purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <div
                key={investment.id}
                style={{
                  background: 'white',
                  borderRadius: '15px',
                  padding: '1.5rem',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ 
                    color: '#1f2937', 
                    fontSize: '1.2rem', 
                    marginBottom: '0.5rem',
                    fontWeight: '600'
                  }}>
                    {investment.name}
                  </h3>
                  <span style={{
                    background: '#10b981',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '500'
                  }}>
                    Ativo
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '0.5rem' 
                  }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Valor Atual:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>
                      {formatCurrency(investment.currentValue)}
                    </span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '0.5rem' 
                  }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Rendimento:</span>
                    <span style={{ 
                      fontWeight: '600', 
                      color: yieldPercentage >= 0 ? '#16a34a' : '#dc2626' 
                    }}>
                      {yieldPercentage.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '0.5rem' 
                  }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Data da Compra:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>
                      {formatDate(investment.purchaseDate)}
                    </span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between' 
                  }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Tempo Decorrido:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>
                      {elapsedDays} dias
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRedeem(investment)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Resgatar Investimento
                </button>
              </div>
            );
          })}
        </div>

        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '2rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#1f2937', marginBottom: '1rem' }}>
            Componente de Resgate Integrado
          </h2>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Este exemplo demonstra como integrar o componente InvestmentRedemption 
            em uma aplicação existente. O componente pode ser personalizado e 
            adaptado conforme necessário para diferentes cenários de uso.
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem'
          }}>
            <div style={{
              background: '#f9fafb',
              borderRadius: '10px',
              padding: '1rem',
              borderLeft: '4px solid #667eea'
            }}>
              <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>✅ TypeScript</h4>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                Tipagem forte e segura
              </p>
            </div>
            
            <div style={{
              background: '#f9fafb',
              borderRadius: '10px',
              padding: '1rem',
              borderLeft: '4px solid #16a34a'
            }}>
              <h4 style={{ color: '#16a34a', marginBottom: '0.5rem' }}>🎨 Styled-Components</h4>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                CSS-in-JS moderno
              </p>
            </div>
            
            <div style={{
              background: '#f9fafb',
              borderRadius: '10px',
              padding: '1rem',
              borderLeft: '4px solid #f59e0b'
            }}>
              <h4 style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>📱 Responsivo</h4>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                Adapta-se a qualquer tela
              </p>
            </div>
            
            <div style={{
              background: '#f9fafb',
              borderRadius: '10px',
              padding: '1rem',
              borderLeft: '4px solid #ef4444'
            }}>
              <h4 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>🛡️ Seguro</h4>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                Tratamento robusto de erros
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestIntegration;