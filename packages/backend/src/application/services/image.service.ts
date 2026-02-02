/**
 * ImageService
 * 
 * Este serviço cuida da "Blindagem de Armazenamento". 
 * Ele detecta se uma string é uma imagem em Base64 e, se for, 
 * faz o upload para o ImgBB (armazenamento externo gratuito).
 */

export class ImageService {
    // Chave de API do ImgBB (Josias, você pode trocar pela sua em api.imgbb.com)
    private static IMGBB_API_KEY = process.env.IMGBB_API_KEY || '5b331002ee8109d3da146b96e6259c40';

    /**
     * Verifica se é Base64 e faz o upload se necessário.
     * Se já for uma URL, apenas retorna a URL.
     */
    static async uploadIfBase64(content: string): Promise<string> {
        if (!content) return content;

        // Se começar com http, já é um link externo
        if (content.startsWith('http')) {
            return content;
        }

        // Se for Base64 (geralmente começa com data:image)
        if (content.includes(';base64,')) {
            console.log('[ImageService] Detetado Base64. Iniciando upload para ImgBB...');
            try {
                return await this.uploadToImgBB(content);
            } catch (error) {
                console.error('[ImageService] Erro no upload:', error);
                // Em caso de erro, retornamos o original (fallback de segurança)
                return content;
            }
        }

        return content;
    }

    /**
     * Faz o upload real para a API do ImgBB
     */
    private static async uploadToImgBB(base64Data: string): Promise<string> {
        // Remover o prefixo "data:image/jpeg;base64," para enviar apenas o binário codificado
        const base64Clean = base64Data.split(',')[1] || base64Data;

        const formData = new URLSearchParams();
        formData.append('image', base64Clean);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('[ImageService] Upload concluído com sucesso:', result.data.url);
            return result.data.url;
        } else {
            throw new Error(result.error?.message || 'Erro desconhecido no ImgBB');
        }
    }

    /**
     * Processa um array de imagens (Galeria)
     */
    static async uploadMultiple(images: string[]): Promise<string[]> {
        if (!images || !Array.isArray(images)) return [];

        const uploadPromises = images.map(img => this.uploadIfBase64(img));
        return await Promise.all(uploadPromises);
    }
}
