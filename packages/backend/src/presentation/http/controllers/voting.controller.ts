import { Context } from 'hono';
import { sql, pool } from '../../../infrastructure/database/postgresql/connection/pool';
import { GovernanceService } from '../../../domain/services/governance.service';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { UserContext } from '../../../shared/types/hono.types';

export class VotingController {
    /**
     * Criar Proposta
     */
    static async createProposal(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { title, description, category = 'general', durationDays = 7 } = await c.req.json();

            if (!title || !description) {
                return c.json({ success: false, message: 'Título e descrição são obrigatórios.' }, 400);
            }

            const canPropose = user.isAdmin || user.score >= 800;
            if (!canPropose) {
                return c.json({ success: false, message: 'Você precisa de pelo menos 800 pontos de score para criar uma proposta.' }, 403);
            }

            const result = await GovernanceService.createProposal(user.id, title, description, category, durationDays);
            return c.json({ success: true, data: result[0] });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar Propostas
     */
    static async listProposals(c: Context) {
        try {
            const user = c.get('user') as UserContext;

            const proposals = await sql`
                SELECT p.*, v.choice as user_choice, u.name as creator_name
                FROM governance_proposals p
                LEFT JOIN users u ON u.id = p.creator_id
                LEFT JOIN governance_votes v ON v.proposal_id = p.id AND v.user_id = ${user.id}
                ORDER BY p.created_at DESC
            `;

            const userPower = await GovernanceService.calculateUserVotingPower(user.id);

            return c.json({
                success: true,
                data: proposals,
                userCurrentPower: userPower
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Votar
     */
    static async vote(c: Context) {
        try {
            const { proposalId, choice } = await c.req.json();
            const user = c.get('user') as UserContext;

            if (!['yes', 'no'].includes(choice)) {
                return c.json({ success: false, message: 'Escolha inválida.' }, 400);
            }

            const result = await GovernanceService.vote(user.id, proposalId, choice);

            await updateScore(pool, user.id, SCORE_REWARDS.VOTING_PARTICIPATION, `Votou na proposta #${proposalId} com peso ${result.powerApplied}`);

            return c.json({
                success: true,
                message: `Voto registrado! Seu peso de decisão foi de ${result.powerApplied.toFixed(2)} pontos.`,
                powerApplied: result.powerApplied
            });
        } catch (error: any) {
            if (error.code === '23505') {
                return c.json({ success: false, message: 'Você já participou desta votação.' }, 400);
            }
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Encerrar Votação
     */
    static async closeProposal(c: Context) {
        const id = c.req.param('id');
        try {
            const proposal = await sql`SELECT * FROM governance_proposals WHERE id = ${id}`;

            if (proposal.length === 0) return c.json({ success: false, message: 'Proposta não encontrada.' }, 404);

            const p = proposal[0];
            const status = p.yes_votes_power > p.no_votes_power ? 'passed' : 'rejected';

            await sql`
                UPDATE governance_proposals 
                SET status = ${status}, expires_at = NOW() 
                WHERE id = ${id}
            `;

            return c.json({
                success: true,
                message: `Votação encerrada. Resultado: ${status.toUpperCase()}`,
                results: {
                    yes: p.yes_votes_power,
                    no: p.no_votes_power
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
