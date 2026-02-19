/**
 * Utilitários para validação de segurança JWT
 * 
 * SEGURANÇA: Garante que JWT_SECRET seja forte o suficiente
 */

const MIN_JWT_SECRET_LENGTH = 32; // 256 bits mínimo
const WEAK_SECRETS = [
    'secret',
    'jwt_secret',
    'super_secret',
    'super_secret_jwt_key',
    'super_secret_jwt_key_production',
    'super_secret_jwt_key_production_2025',
    'change_me',
    'changeme',
    'development',
    'test'
];

export function validateJwtSecret(): void {
    if (process.env.NODE_ENV === 'test') {
        console.warn('⚠️  [TEST ENV] Validação de força JWT ignorada.');
        return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error(
            '🔴 ERRO CRÍTICO DE SEGURANÇA: JWT_SECRET não está definido no .env!\n' +
            'Execute: openssl rand -base64 64'
        );
    }

    if (secret.length < MIN_JWT_SECRET_LENGTH) {
        throw new Error(
            `🔴 ERRO CRÍTICO DE SEGURANÇA: JWT_SECRET muito curto (${secret.length} chars).\n` +
            `Mínimo requerido: ${MIN_JWT_SECRET_LENGTH} caracteres.\n` +
            'Execute: openssl rand -base64 64'
        );
    }

    const secretLower = secret.toLowerCase();
    const isWeak = WEAK_SECRETS.some(weak => secretLower.includes(weak));

    if (isWeak) {
        throw new Error(
            '🔴 ERRO CRÍTICO DE SEGURANÇA: JWT_SECRET contém palavra fraca/comum!\n' +
            'Não use: "secret", "test", "development", etc.\n' +
            'Execute: openssl rand -base64 64'
        );
    }

    // Verificar entropia básica (deve ter pelo menos alguns caracteres especiais/números)
    const hasNumbers = /\d/.test(secret);
    const hasSpecialChars = /[^a-zA-Z0-9]/.test(secret);

    if (!hasNumbers || !hasSpecialChars) {
        console.warn(
            '⚠️  AVISO DE SEGURANÇA: JWT_SECRET pode ter baixa entropia.\n' +
            'Recomendado gerar novo segredo: openssl rand -base64 64'
        );
    }

    console.log('✅ JWT_SECRET validado com sucesso (comprimento: ' + secret.length + ' chars)');
}
