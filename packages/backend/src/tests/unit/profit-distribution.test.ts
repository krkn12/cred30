import { describe, it, expect, vi } from 'vitest';
import { distributeProfits } from '../../application/services/profit-distribution.service';

describe('Profit Distribution Service', () => {
    const mockPool = {
        query: vi.fn()
    };

    it('deve retornar erro se não houver lucro acumulado', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ profit_pool: 0 }] });
        const result = await distributeProfits(mockPool as any);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Não há resultados acumulados para distribuir');
    });

    it('deve calcular corretamente as cotas ponderadas com bônus', async () => {
        // Mock system_config
        mockPool.query.mockResolvedValueOnce({ rows: [{ profit_pool: 1000 }] });

        // Mock eligible users
        mockPool.query.mockResolvedValueOnce({
            rows: [
                { user_id: 1, quota_count: 10, two_factor_enabled: true, membership_type: 'PRO', paid_loans: 2, total_spent: 1000, total_revenue_generated: 200 },
                { user_id: 2, quota_count: 10, two_factor_enabled: false, membership_type: 'FREE', paid_loans: 0, total_spent: 0, total_revenue_generated: 0 }
            ]
        });

        // Mocks para os updates e notificações que ocorrem dentro da função
        mockPool.query.mockResolvedValue({ rows: [] }); // Update config, transactions, etc.

        const result = await distributeProfits(mockPool as any);

        expect(result.success).toBe(true);
        expect(result.data.totalProfit).toBe(1000);

        // Verificação manual dos multiplicadores para o User 1:
        // Base: 1.0
        // 2FA: +0.1
        // PRO: +0.2
        // Paid Loans (2 * 0.05): +0.1
        // Spent (1000 / 500 * 0.1): +0.2
        // Revenue (200 / 100 * 0.2): +0.4
        // Total Multiplier: 1.0 + 0.1 + 0.2 + 0.1 + 0.2 + 0.4 = 2.0
        // Weighted Quotas: 10 * 2.0 = 20

        // User 2:
        // Base: 1.0 (sem bônus)
        // Weighted Quotas: 10 * 1.0 = 10

        // Total Weighted: 30
        expect(result.data.totalWeightedQuotas).toBe(30);
    });
});
