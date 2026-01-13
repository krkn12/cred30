import { describe, it, expect, vi } from 'vitest';
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
        const mockPool = {
            query: vi.fn()
        };

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
            // Mock para isGuarantor
            mockPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });

            const result = await checkLoanEligibility(mockPool as any, 'user-123');
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

            // Mock para isGuarantor
            mockPool.query.mockResolvedValueOnce({
                rows: [{ count: 0 }]
            });

            const result = await checkLoanEligibility(mockPool as any, 'user-123');
            expect(result.eligible).toBe(true);
            // Limite = (80% + 5% bonus) * totalSpent + (50% + 5% bonus) * quotasValue + userProfitShare
            // totalSpent = 1000 + (2 * 8) = 1016
            // spentLimit = 1016 * 0.85 = 863.6
            // quotasLimit = 200 * 0.55 = 110
            // userProfitShare = 1000 * (2/100) = 20
            // total = 863.6 + 110 + 20 = 993.6 -> floor = 993
            expect(result.details.maxLoanAmount).toBe(993);
        });
    });
});
