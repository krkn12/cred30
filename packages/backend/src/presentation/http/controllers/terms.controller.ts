import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';

/**
 * Controller para gerenciar aceite de termos de uso
 */
export class TermsController {

    /**
     * Aceitar termos de vendedor
     */
    static async acceptSellerTerms(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            await pool.query(
                `UPDATE users SET seller_terms_accepted_at = NOW() WHERE id = $1`,
                [user.id]
            );

            return c.json({
                success: true,
                message: 'Termos de vendedor aceitos com sucesso!',
                acceptedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('[TERMS] Erro ao aceitar termos de vendedor:', error);
            return c.json({ success: false, message: 'Erro ao aceitar termos' }, 500);
        }
    }

    /**
     * Aceitar termos de entregador
     */
    static async acceptCourierTerms(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            await pool.query(
                `UPDATE users SET courier_terms_accepted_at = NOW() WHERE id = $1`,
                [user.id]
            );

            return c.json({
                success: true,
                message: 'Termos de entregador aceitos com sucesso!',
                acceptedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('[TERMS] Erro ao aceitar termos de entregador:', error);
            return c.json({ success: false, message: 'Erro ao aceitar termos' }, 500);
        }
    }

    /**
     * Verificar status dos termos do usuário
     */
    static async getTermsStatus(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT seller_terms_accepted_at, courier_terms_accepted_at FROM users WHERE id = $1`,
                [user.id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
            }

            const userData = result.rows[0];

            return c.json({
                success: true,
                data: {
                    sellerTermsAccepted: !!userData.seller_terms_accepted_at,
                    sellerTermsAcceptedAt: userData.seller_terms_accepted_at,
                    courierTermsAccepted: !!userData.courier_terms_accepted_at,
                    courierTermsAcceptedAt: userData.courier_terms_accepted_at
                }
            });
        } catch (error) {
            console.error('[TERMS] Erro ao verificar termos:', error);
            return c.json({ success: false, message: 'Erro ao verificar termos' }, 500);
        }
    }

    /**
     * Obter texto dos termos de vendedor
     */
    static async getSellerTermsText(c: Context) {
        return c.json({
            success: true,
            data: {
                title: 'Termos de Uso - Vendedor Cred30',
                version: '1.0',
                lastUpdated: '2026-01-29',
                content: `
## TERMOS E CONDIÇÕES PARA VENDEDORES

Ao me cadastrar como vendedor na plataforma Cred30, declaro que:

### 1. RESPONSABILIDADE SOBRE PRODUTOS
✓ Sou o único responsável pela qualidade, veracidade e legalidade dos produtos que anuncio.
✓ Garantirei que os produtos estejam em perfeitas condições para entrega.
✓ Não anunciarei produtos proibidos, falsificados ou que infrinjam direitos de terceiros.

### 2. NATUREZA DA PLATAFORMA
✓ Compreendo que a Cred30 é uma plataforma de tecnologia que apenas conecta vendedores e compradores.
✓ A Cred30 NÃO é parte no contrato de compra e venda entre mim e o comprador.
✓ A relação comercial é exclusivamente entre mim (vendedor) e o comprador.

### 3. SISTEMA DE GARANTIA
✓ Aceito o sistema de escrow (retenção) da plataforma para proteção das transações.
✓ Compreendo que meu pagamento será liberado após confirmação de recebimento pelo comprador.
✓ Em caso de disputa, aceito a mediação da plataforma.

### 4. FUNDO DE SEGURO DE ENTREGAS
✓ Em caso de incidente durante a entrega (perda, dano, acidente), serei ressarcido pelo fundo de seguro.
✓ O ressarcimento está limitado ao valor do produto vendido.

### 5. TAXAS E COMISSÕES
✓ Aceito as taxas de serviço aplicáveis conforme minha situação (verificado/não-verificado).
✓ Compreendo que as taxas podem ser alteradas com aviso prévio de 30 dias.

Ao clicar em "Aceitar", confirmo que li, compreendi e concordo com todos os termos acima.
                `.trim()
            }
        });
    }

    /**
     * Obter texto dos termos de entregador
     */
    static async getCourierTermsText(c: Context) {
        return c.json({
            success: true,
            data: {
                title: 'Termos de Uso - Entregador Parceiro Cred30',
                version: '1.0',
                lastUpdated: '2026-01-29',
                content: `
## TERMOS E CONDIÇÕES PARA ENTREGADORES PARCEIROS

Ao me cadastrar como entregador parceiro na plataforma Cred30, declaro que:

### 1. NATUREZA DO VÍNCULO
✓ Sou um PRESTADOR DE SERVIÇOS AUTÔNOMO.
✓ NÃO possuo vínculo empregatício com a Cred30.
✓ Sou responsável por meus próprios impostos, seguros e obrigações fiscais.

### 2. RESPONSABILIDADE DURANTE ENTREGAS
✓ Sou o único responsável pelos produtos durante o transporte.
✓ Comprometo-me a cuidar adequadamente dos itens coletados.
✓ Em caso de danos ou perdas por minha negligência, serei responsabilizado.

### 3. FUNDO DE SEGURO (CONTRIBUIÇÃO OBRIGATÓRIA)
✓ Aceito que 5% dos meus ganhos por entrega serão reservados para o fundo de seguro.
✓ Este valor será liberado de volta para mim ao final de cada entrega bem-sucedida.
✓ Em caso de incidente comprovado (perda, dano, acidente), o fundo será usado para ressarcimento.

### 4. AUTORIZAÇÃO DE DÉBITO
✓ AUTORIZO a Cred30 a debitar do meu saldo valores referentes a:
  - Indenizações por danos comprovados
  - Penalidades por cancelamentos de última hora
  - Ressarcimentos devidos a vendedores ou compradores

### 5. REPORTAR INCIDENTES
✓ Em caso de imprevisto (acidente, roubo, emergência), devo reportar IMEDIATAMENTE pelo app.
✓ Compreendo que não reportar poderá resultar em penalidades maiores.

### 6. CANCELAMENTOS
✓ Posso cancelar uma entrega ANTES de coletar o produto sem penalidade.
✓ Cancelar APÓS a coleta resultará em investigação e possíveis penalidades.

### 7. PENALIDADES
✓ Cancelamentos frequentes afetarão meu score e acesso a novas entregas.
✓ Má-fé comprovada resultará em banimento permanente da plataforma.

Ao clicar em "Aceitar", confirmo que li, compreendi e concordo com todos os termos acima.
                `.trim()
            }
        });
    }
}
