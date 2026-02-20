import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateInterestRate, checkLoanEligibility } from '../../application/services/credit-analysis.service';

describe('Credit Analysis Service', () => {
    describe('calculateInterestRate', () => {
        it('deve retornar 35% de juros para 50% de garantia', () => {
            expect(calculateInterestRate(50)).toBe(0.35);
        });

        it('deve retornar 10% de juros para 100% de garantia', () => {
            expect(calculateInterestRate(100)).toBe(0.10);
        });

        it('deve retornar a taxa correta para valores intermediários', () => {
            expect(calculateInterestRate(75)).toBe(0.18); // <= 80
            expect(calculateInterestRate(85)).toBe(0.14); // <= 90
        });
    });

    describe('checkLoanEligibility', () => {
        const mockQuery = vi.fn();
        const mockPool = {
            query: mockQuery
        };

        beforeEach(() => {
            mockQuery.mockReset();
        });

        it('deve retornar inelegível se o usuário não for encontrado', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });
            const result = await checkLoanEligibility(mockPool as any, 'user-123');
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('Usuário não encontrado');
        });

        it('deve retornar inelegível se houver empréstimos em atraso', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{
                    score: 500,
                    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
                    quotas_count: 1,
                    total_quotas_value: 100,
                    purchases: 5,
                    sales: 2,
                    overdue_loans: 1,
                    marketplace_spent: 500,
                    campaign_spent: 0,
                    platform_spent: 0,
                    pending_quotas: 0
                }]
            });
            // Mock para system_config (mesmo que não use o resultado, o código chama)
            mockPool.query.mockResolvedValueOnce({ rows: [{ profit_pool: 0, system_total_quotas: 100 }] });
            // Mock para Late History (NOVO)
            mockPool.query.mockResolvedValueOnce({ rows: [{ late_count: 0 }] });
            // Mock para isGuarantor
            mockPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
            // Mock para Active Debt (NOVO)
            mockPool.query.mockResolvedValueOnce({ rows: [{ total_owed: 0, total_paid: 0 }] });

            const result = await checkLoanEligibility(mockPool as any, 'user-123');
            console.log('Result 1:', result);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('Você possui empréstimos em atraso.');
        });

        it('deve calcular o limite corretamente baseado no gasto e cotas', async () => {
            // Mock para userData
            mockPool.query.mockResolvedValueOnce({
                rows: [{
                    score: 600,
                    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                    quotas_count: 2,
                    total_quotas_value: 200,
                    purchases: 10,
                    sales: 5,
                    overdue_loans: 0,
                    marketplace_spent: 1000,
                    campaign_spent: 0,
                    platform_spent: 0,
                    pending_quotas: 0
                }]
            });

            // Mock para system_config (profit_pool)
            mockPool.query.mockResolvedValueOnce({
                rows: [{ profit_pool: 1000, system_total_quotas: 100 }]
            });

            // Mock para Late History (NOVO)
            mockPool.query.mockResolvedValueOnce({ rows: [{ late_count: 0 }] });

            // Mock para isGuarantor
            mockPool.query.mockResolvedValueOnce({
                rows: [{ count: 0 }]
            });

            // Mock para Active Debt (NOVO)
            mockPool.query.mockResolvedValueOnce({ rows: [{ total_owed: 0, total_paid: 0 }] });

            const result = await checkLoanEligibility(mockPool as any, 'user-123');
            console.log('Result 2:', result);
            expect(result.eligible).toBe(true);
            // Nova Lógica:
            // Base Spends: 70% | Base Quotas: 70% (linha 27-28 do serviço)
            // Score Bonus: (600/1000) * 10% = 6%
            // Total Factor: 0.70 + 0.06 = 0.76
            // totalSpent = 1016 * 0.76 = 772.16
            // quotasValue = 200 * 0.76 = 152.00
            // Total = 924.16 -> floor = 924
            expect(result.details.maxLoanAmount).toBe(924);
        });
    });
});
