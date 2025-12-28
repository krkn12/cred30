import { sql } from '../../infrastructure/database/postgresql/connection/pool';

export class GovernanceService {
    /**
     * Calcula o poder de voto de um usuário com base no modelo democrático V2:
     * Poder = (1 + sqrt(Cotas)) * (1 + Score/1000)
     * 
     * Isso garante que:
     * 1. Todos tenham no mínimo 1 de poder.
     * 2. Grandes detentores de cotas tenham poder limitado (raiz quadrada).
     * 3. Membros ativos (alto Score) tenham seu poder multiplicado.
     */
    static async calculateUserVotingPower(userId: string): Promise<number> {
        const result = await sql`
      SELECT 
        u.score,
        COUNT(q.id) as quota_count
      FROM users u
      LEFT JOIN quotas q ON q.user_id = u.id AND q.status = 'ACTIVE'
      WHERE u.id = ${userId}
      GROUP BY u.id, u.score
    `;

        if (result.length === 0) return 0;

        const { score, quota_count } = result[0];

        const basePower = 1;
        const quotaPower = Math.sqrt(Number(quota_count));
        const reputationMultiplier = 1 + (Number(score) / 1000);

        const totalPower = (basePower + quotaPower) * reputationMultiplier;

        return Number(totalPower.toFixed(2));
    }

    static async createProposal(userId: string, title: string, description: string, category: string, durationDays: number = 7) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        return await sql`
      INSERT INTO governance_proposals (title, description, creator_id, category, expires_at)
      VALUES (${title}, ${description}, ${userId}, ${category}, ${expiresAt})
      RETURNING *
    `;
    }

    static async vote(userId: string, proposalId: string, choice: 'yes' | 'no') {
        // 1. Verificar se a proposta está ativa
        const proposal = await sql`
      SELECT * FROM governance_proposals 
      WHERE id = ${proposalId} AND status = 'active' AND expires_at > NOW()
    `;

        if (proposal.length === 0) {
            throw new Error('Proposta não encontrada ou já encerrada.');
        }

        // 2. Calcular poder atual do usuário
        const power = await this.calculateUserVotingPower(userId);
        if (power <= 0) {
            throw new Error('Você não possui poder de voto (mínimo 2 cotas recomendado).');
        }

        // 3. Registrar o voto (monitore o UNIQUE constraint para evitar votos duplicados)
        await sql.begin(async (tx) => {
            await tx`
        INSERT INTO governance_votes (proposal_id, user_id, choice, voting_power)
        VALUES (${proposalId}, ${userId}, ${choice}, ${power})
      `;

            // 4. Atualizar o poder acumulado na proposta para visualização rápida
            if (choice === 'yes') {
                await tx`
          UPDATE governance_proposals 
          SET yes_votes_power = yes_votes_power + ${power}
          WHERE id = ${proposalId}
        `;
            } else {
                await tx`
          UPDATE governance_proposals 
          SET no_votes_power = no_votes_power + ${power}
          WHERE id = ${proposalId}
        `;
            }
        });

        return { success: true, powerApplied: power };
    }
}
