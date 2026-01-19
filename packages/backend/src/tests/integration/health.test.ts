import { describe, it, expect } from 'vitest';
import { app } from '../../index';

describe('Health Check Integration Test', () => {
    it('should return 200 OK for /api/health', async () => {
        const res = await app.request('/api/health');
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.status).toBe('ok');
        expect(data).toHaveProperty('version');
    });

    it('should return 200 for root endpoint', async () => {
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.message).toBe('Cred30 API Online');
    });
});
