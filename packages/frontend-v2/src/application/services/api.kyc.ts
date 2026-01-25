
import { ApiBase } from './api.base';

export class KycApi extends ApiBase {
    /**
   * Envia documento para armazenamento seguro (Multipart/Form-Data)
   * @param file Arquivo a ser enviado
   * @param docType Tipo: 'ID' (RG/CNH), 'VEHICLE' (Foto Veículo), 'DOC_VEHICLE' (CRLV/Nota)
   */
    async uploadDocument(file: File, docType: string = 'ID') {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('docType', docType);

        const token = localStorage.getItem('token');

        // Upload manual com fetch pois ApiBase geralmente espera JSON
        const response = await fetch(`${this.baseUrl}/kyc/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // Não setar Content-Type, o browser seta multipart boundary sozinho
            },
            body: formData
        });

        return await response.json();
    }

    /**
     * Admin: Revisar Status
     */
    async reviewKyc(userId: string | number, status: 'APPROVED' | 'REJECTED', notes: string) {
        return this.post('/kyc/review', { userId, status, notes });
    }

    /**
     * Admin: Ver Documento (Retorna Blob para criar URL local)
     */
    async viewDocument(userId: string | number): Promise<Blob | null> {
        const token = localStorage.getItem('token');
        const res = await fetch(`${this.baseUrl}/kyc/doc/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            return await res.blob();
        }
        return null;
    }
}
