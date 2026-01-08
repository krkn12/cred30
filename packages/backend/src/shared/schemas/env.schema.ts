import { z } from 'zod';

const envSchema = z.object({
    // Banco de Dados
    DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),

    // Segurança
    JWT_SECRET: z.string().min(8, 'JWT_SECRET deve ter pelo menos 8 caracteres'),

    // Servidor
    PORT: z.string().default('3001'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Firebase (Opcional, mas se presente deve ser um JSON válido)
    FIREBASE_SERVICE_ACCOUNT: z.string().optional().refine((val) => {
        if (!val) return true;
        try {
            JSON.parse(val);
            return true;
        } catch {
            return false;
        }
    }, 'FIREBASE_SERVICE_ACCOUNT deve ser um JSON válido'),

    // Pix Admin (Opcional, usado em promo-videos)
    // ADMIN_PIX_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = () => {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error('❌ Erro de configuração nas variáveis de ambiente:');
        console.error(parsed.error.flatten().fieldErrors);
        process.exit(1);
    }

    return parsed.data;
};
