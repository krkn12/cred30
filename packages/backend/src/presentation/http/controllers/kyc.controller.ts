
import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Pasta Segura (Fora do Public)
const SECURE_STORAGE_PATH = path.resolve(__dirname, '../../../../secure_storage/kyc');

// Garantir que a pasta existe
if (!fs.existsSync(SECURE_STORAGE_PATH)) {
    fs.mkdirSync(SECURE_STORAGE_PATH, { recursive: true });
}

export class KycController {

    /**
     * Upload de Documento para Verificação
     */
    static async uploadDocument(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const body = await c.req.parseBody();
            const file = body['document'];
            const docType = body['docType'] as string || 'ID'; // ID, VEHICLE, DOC_VEHICLE

            if (!file || typeof file === 'string') {
                return c.json({ success: false, message: 'Arquivo obrigatório' }, 400);
            }

            // Validação de Tipo
            const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                return c.json({ success: false, message: 'Formato inválido. Use JPG, PNG ou PDF.' }, 400);
            }

            // Gerar nome seguro (Hash)
            const fileExt = file.name.split('.').pop();
            const secureName = `${crypto.randomBytes(16).toString('hex')}_${docType}.${fileExt}`;
            const diskPath = path.join(SECURE_STORAGE_PATH, secureName);

            // Salvar arquivo
            const fileData = await file.arrayBuffer();
            fs.writeFileSync(diskPath, Buffer.from(fileData));

            // Atualizar BD baseado no tipo
            const pool = getDbPool(c);
            let updateQuery = '';

            if (docType === 'VEHICLE') {
                updateQuery = `UPDATE users SET courier_vehicle_photo = $1 WHERE id = $2`;
            } else if (docType === 'DOC_VEHICLE') {
                updateQuery = `UPDATE users SET courier_doc_photo = $1 WHERE id = $2`;
            } else if (docType === 'BUSINESS') {
                updateQuery = `UPDATE users SET business_license_path = $1, kyc_status = 'PENDING' WHERE id = $2`;
            } else {
                // Padrão: Documento de Identidade (KYC)
                updateQuery = `UPDATE users SET kyc_status = 'PENDING', kyc_document_path = $1, courier_id_photo = $1 WHERE id = $2`;
            }

            await pool.query(updateQuery, [secureName, user.id]);

            return c.json({ success: true, message: 'Documento enviado com sucesso.', fileName: secureName });

        } catch (error) {
            console.error('KYC Upload Error:', error);
            return c.json({ success: false, message: 'Erro no upload' }, 500);
        }
    }

    /**
     * Visualizar Documento (Apenas Admin ou Dono)
     */
    static async viewDocument(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const userIdTarget = c.req.param('userId');
            const docType = c.req.query('type') || 'ID'; // ID, VEHICLE, DOC_VEHICLE

            const pool = getDbPool(c);

            // Verificar permissão
            const canView = user.isAdmin || user.id.toString() === userIdTarget.toString();
            if (!canView) return c.json({ success: false, message: 'Acesso negado.' }, 403);

            // Mapear coluna baseada no tipo
            let column = 'kyc_document_path';
            if (docType === 'VEHICLE') column = 'courier_vehicle_photo';
            if (docType === 'DOC_VEHICLE') column = 'courier_doc_photo';

            // Buscar nome do arquivo no banco
            const res = await pool.query(`SELECT ${column} FROM users WHERE id = $1`, [userIdTarget]);
            if (res.rows.length === 0 || !res.rows[0][column]) {
                return c.json({ success: false, message: 'Documento não encontrado.' }, 404);
            }

            const fileName = res.rows[0][column];
            const diskPath = path.join(SECURE_STORAGE_PATH, fileName);

            if (!fs.existsSync(diskPath)) {
                return c.json({ success: false, message: 'Arquivo físico não encontrado.' }, 404);
            }

            // Servir arquivo
            const fileContent = fs.readFileSync(diskPath);
            const ext = path.extname(fileName).toLowerCase();
            const contentType = ext === '.pdf' ? 'application/pdf' :
                ext === '.png' ? 'image/png' : 'image/jpeg';

            c.header('Content-Type', contentType);
            return c.body(fileContent);

        } catch (error) {
            console.error('KYC View Error:', error);
            return c.json({ success: false, message: 'Erro ao visualizar' }, 500);
        }
    }

    /**
     * Solicitar Revisão (Sem Upload - Flow Simplificado)
     */
    static async requestReview(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // Verifica se já não está aprovado
            const check = await pool.query('SELECT kyc_status FROM users WHERE id = $1', [user.id]);
            if (check.rows[0]?.kyc_status === 'APPROVED') {
                return c.json({ success: false, message: 'Já verificado' }, 400);
            }

            // Atualiza para PENDING
            await pool.query(
                `UPDATE users SET kyc_status = 'PENDING', kyc_notes = 'Solicitação Simplificada via App' WHERE id = $1`,
                [user.id]
            );

            return c.json({ success: true, message: 'Solicitação enviada com sucesso.' });
        } catch (error) {
            console.error('KYC Request Error:', error);
            return c.json({ success: false, message: 'Erro ao solicitar' }, 500);
        }
    }

    /**
     * Aprovar/Rejeitar KYC (Admin)
     */
    static async reviewKyc(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            if (!user.isAdmin) return c.json({ success: false, message: 'Apenas Admin' }, 403);

            const { userId, status, notes } = await c.req.json();
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                return c.json({ success: false, message: 'Status inválido' }, 400);
            }

            const pool = getDbPool(c);
            await pool.query(
                `UPDATE users SET kyc_status = $1, kyc_notes = $2, is_verified = $4 WHERE id = $3`,
                [status, notes, userId, status === 'APPROVED']
            );

            // Se aprovado, poderia liberar automaticamente tags de "Vendedor Verificado" etc.

            return c.json({ success: true, message: `Status atualizado para ${status}` });
        } catch (error) {
            return c.json({ success: false, message: 'Erro na revisão' }, 500);
        }
    }
}
