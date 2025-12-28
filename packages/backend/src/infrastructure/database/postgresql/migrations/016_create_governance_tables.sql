-- Tabela de Propostas de Votação
CREATE TABLE IF NOT EXISTS governance_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    creator_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'passed', 'rejected', 'executed')),
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'financial', 'regulation', 'exclusion')),
    yes_votes_power DECIMAL(20, 2) DEFAULT 0,
    no_votes_power DECIMAL(20, 2) DEFAULT 0,
    min_power_quorum DECIMAL(20, 2) DEFAULT 100, -- Mínimo de poder total para validar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Tabela de Votos Individuais
CREATE TABLE IF NOT EXISTS governance_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES governance_proposals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    choice TEXT NOT NULL CHECK (choice IN ('yes', 'no')),
    voting_power DECIMAL(20, 2) NOT NULL, -- O peso do voto calculado no momento da ação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, user_id) -- Um membro, um voto por proposta
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gov_votes_proposal ON governance_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_status ON governance_proposals(status);
