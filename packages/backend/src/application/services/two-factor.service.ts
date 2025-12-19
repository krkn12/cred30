
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export class TwoFactorService {
    /**
     * Gera um novo segredo para o usuário
     */
    generateSecret(): string {
        return authenticator.generateSecret();
    }

    /**
     * Gera o URI para o app de autenticação
     */
    generateOtpUri(email: string, secret: string): string {
        return authenticator.keyuri(email, 'Cred30', secret);
    }

    /**
     * Gera o QR Code em formato DataURI (Base64)
     */
    async generateQrCode(otpUri: string): Promise<string> {
        return await QRCode.toDataURL(otpUri);
    }

    /**
     * Verifica se o token digitado pelo usuário é válido
     */
    verifyToken(token: string, secret: string): boolean {
        // Na prática, tokens costumam ter 6 dígitos
        return authenticator.check(token, secret);
    }
}

export const twoFactorService = new TwoFactorService();
