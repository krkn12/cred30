import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// Interfaces TypeScript
interface InvestmentData {
  id: string;
  currentValue: number;
  purchaseValue: number;
  purchaseDate: Date;
  redemptionPenalty: number;
}

interface RedemptionCalculation {
  totalValue: number;
  penaltyAmount: number;
  netValue: number;
  yieldPercentage: number;
  elapsedDays: number;
}

// Styled Components
const Container = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  margin: 0 auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    margin: 1rem;
  }
`;

const Title = styled.h2`
  color: white;
  text-align: center;
  margin-bottom: 2rem;
  font-size: 1.8rem;
  font-weight: 600;
  
  @media (max-width: 768px) {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }
`;

const Card = styled.div`
  background: white;
  border-radius: 15px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
  }
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.span`
  color: #6b7280;
  font-size: 0.9rem;
  font-weight: 500;
`;

const Value = styled.span<{ color?: string; animated?: boolean }>`
  font-weight: 600;
  font-size: 1.1rem;
  color: ${props => props.color || '#1f2937'};
  transition: all 0.5s ease;
  
  ${props => props.animated && `
    animation: pulse 0.5s ease-in-out;
  `}
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;

const HighlightCard = styled(Card)`
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
`;

const Button = styled.button`
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1.5rem;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ErrorMessage = styled.div`
  background: #fee;
  color: #c53030;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
`;

const SuccessMessage = styled.div`
  background: #f0fdf4;
  color: #16a34a;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
`;

// Componente Principal
const InvestmentRedemption: React.FC = () => {
  const [investment, setInvestment] = useState<InvestmentData | null>(null);
  const [calculation, setCalculation] = useState<RedemptionCalculation | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [animateValue, setAnimateValue] = useState(false);

  // Dados mockados para demonstração
  const mockInvestment: InvestmentData = {
    id: 'inv_001',
    currentValue: 5500,
    purchaseValue: 5000,
    purchaseDate: new Date('2023-01-15'),
    redemptionPenalty: 0.02 // 2%
  };

  // Função para formatar valores em reais
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar datas
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  // Função para calcular dias decorridos
  const calculateElapsedDays = (purchaseDate: Date): number => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - purchaseDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Função para validar data futura
  const validateDate = (date: Date): boolean => {
    const now = new Date();
    return date <= now;
  };

  // Função para calcular resgate
  const calculateRedemption = (investmentData: InvestmentData): RedemptionCalculation => {
    const elapsedDays = calculateElapsedDays(investmentData.purchaseDate);
    const yieldPercentage = ((investmentData.currentValue - investmentData.purchaseValue) / investmentData.purchaseValue) * 100;
    
    // Verifica se há multa (menos de 1 ano)
    let penaltyAmount = 0;
    if (elapsedDays < 365) {
      penaltyAmount = investmentData.currentValue * investmentData.redemptionPenalty;
    }
    
    const netValue = investmentData.currentValue - penaltyAmount;
    
    return {
      totalValue: investmentData.currentValue,
      penaltyAmount,
      netValue,
      yieldPercentage,
      elapsedDays
    };
  };

  // Função para simular carregamento de dados
  const loadInvestmentData = async () => {
    setIsCalculating(true);
    setError('');
    
    try {
      // Simula delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Validação de data
      if (!validateDate(mockInvestment.purchaseDate)) {
        throw new Error('Data de compra não pode ser no futuro');
      }
      
      setInvestment(mockInvestment);
      const calc = calculateRedemption(mockInvestment);
      setCalculation(calc);
      
      // Animação dos valores
      setAnimateValue(true);
      setTimeout(() => setAnimateValue(false), 500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do investimento');
    } finally {
      setIsCalculating(false);
    }
  };

  // Função para processar resgate
  const handleRedemption = async () => {
    if (!calculation) return;
    
    setIsCalculating(true);
    setError('');
    setSuccess('');
    
    try {
      // Simula chamada de API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSuccess(`Resgate de ${formatCurrency(calculation.netValue)} processado com sucesso!`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar resgate');
    } finally {
      setIsCalculating(false);
    }
  };

  // Carrega dados ao montar o componente
  useEffect(() => {
    loadInvestmentData();
  }, []);

  // Tratamento de erro para valores nulos/indefinidos
  const safeValue = (value: number | null | undefined): number => {
    return value ?? 0;
  };

  if (!investment || !calculation) {
    return (
      <Container>
        <Title>Carregando dados...</Title>
      </Container>
    );
  }

  return (
    <Container>
      <Title>Resgate de Investimento</Title>
      
      <Card>
        <Row>
          <Label>Valor Atual:</Label>
          <Value animated={animateValue}>
            {formatCurrency(safeValue(calculation.totalValue))}
          </Value>
        </Row>
        
        <Row>
          <Label>Rendimento:</Label>
          <Value color={calculation.yieldPercentage >= 0 ? '#16a34a' : '#dc2626'}>
            {calculation.yieldPercentage.toFixed(2)}%
          </Value>
        </Row>
        
        <Row>
          <Label>Data da Compra:</Label>
          <Value>{formatDate(investment.purchaseDate)}</Value>
        </Row>
        
        <Row>
          <Label>Tempo Decorrido:</Label>
          <Value>{calculation.elapsedDays} dias</Value>
        </Row>
        
        {calculation.penaltyAmount > 0 && (
          <Row>
            <Label>Multa por Resgate:</Label>
            <Value color="#dc2626">
              {formatCurrency(safeValue(calculation.penaltyAmount))} ({(investment.redemptionPenalty * 100).toFixed(1)}%)
            </Value>
          </Row>
        )}
      </Card>
      
      <HighlightCard>
        <Row>
          <Label style={{ color: 'white' }}>Valor a Resgatar:</Label>
          <Value style={{ color: 'white' }} animated={animateValue}>
            {formatCurrency(safeValue(calculation.netValue))}
          </Value>
        </Row>
      </HighlightCard>
      
      <Button 
        onClick={handleRedemption}
        disabled={isCalculating || calculation.netValue <= 0}
      >
        {isCalculating ? 'Processando...' : 'Confirmar Resgate'}
      </Button>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
    </Container>
  );
};

export default InvestmentRedemption;