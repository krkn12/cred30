-- =====================================================
-- SCRIPT DE SEED: Dados de Exemplo para Cred30
-- Executar este script para popular funcionalidades
-- =====================================================

-- 1. VÍDEOS PROMOCIONAIS (Farm & Baú de Excedentes)
-- Inserir vídeos de exemplo para o sistema de "View-to-Earn"

INSERT INTO promo_videos (user_id, title, description, video_url, thumbnail_url, platform, duration_seconds, price_per_view, min_watch_seconds, budget, status, is_active, is_approved, daily_limit, target_views, expires_at)
VALUES 
    -- Vídeo 1: Educação Financeira
    (1, 'Como Economizar R$ 500 por Mês', 
     'Dicas práticas para organizar suas finanças e começar a investir mesmo ganhando pouco.',
     'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
     'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
     'YOUTUBE', 180, 0.03, 30, 1000.00, 'ACTIVE', true, true, 500, 5000,
     CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    -- Vídeo 2: Cooperativismo
    (1, 'O que é uma Cooperativa de Crédito?',
     'Entenda como funcionam as cooperativas e por que elas oferecem melhores taxas.',
     'https://www.youtube.com/watch?v=2Z4m4lnjxkY',
     'https://img.youtube.com/vi/2Z4m4lnjxkY/maxresdefault.jpg',
     'YOUTUBE', 240, 0.03, 30, 500.00, 'ACTIVE', true, true, 300, 3000,
     CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    -- Vídeo 3: Investimentos
    (1, 'Primeiros Passos nos Investimentos',
     'Aprenda a investir com apenas R$ 50 por mês e construir seu patrimônio.',
     'https://www.youtube.com/watch?v=J---aiyznGQ',
     'https://img.youtube.com/vi/J---aiyznGQ/maxresdefault.jpg',
     'YOUTUBE', 300, 0.03, 45, 750.00, 'ACTIVE', true, true, 400, 4000,
     CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    -- Vídeo 4: Empreendedorismo
    (1, 'Como Começar um Negócio com Pouco Dinheiro',
     'Ideias de negócios para começar com menos de R$ 1.000 de investimento.',
     'https://www.youtube.com/watch?v=9bZkp7q19f0',
     'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg',
     'YOUTUBE', 420, 0.03, 60, 600.00, 'ACTIVE', true, true, 350, 3500,
     CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    -- Vídeo 5: Dívidas
    (1, 'Saia das Dívidas em 6 Meses',
     'Método comprovado para quitar dívidas e limpar o nome rapidamente.',
     'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
     'https://img.youtube.com/vi/kJQP7kiw5Fk/maxresdefault.jpg',
     'YOUTUBE', 360, 0.03, 45, 800.00, 'ACTIVE', true, true, 400, 4000,
     CURRENT_TIMESTAMP + INTERVAL '30 days')
ON CONFLICT DO NOTHING;

-- 2. PROPOSTA DE GOVERNANÇA (Votação)
-- Criar proposta de exemplo para que usuários possam votar

INSERT INTO governance_proposals (title, description, creator_id, status, category, min_power_quorum, expires_at)
VALUES 
    ('Redução da Taxa de Saque de 3% para 2%',
     'Proposta para reduzir a taxa cobrada em saques via PIX de 3% para 2%, tornando a plataforma mais competitiva e acessível para todos os membros.',
     1, 'active', 'financial', 50.00,
     CURRENT_TIMESTAMP + INTERVAL '7 days'),
    
    ('Criação do Programa de Mentoria Financeira',
     'Implementar um programa onde membros com alta reputação possam mentorar novos associados, recebendo bônus de score por cada mentoria bem-sucedida.',
     1, 'active', 'general', 30.00,
     CURRENT_TIMESTAMP + INTERVAL '14 days'),
    
    ('Aumento do Bônus de Indicação para R$ 10',
     'Aumentar o bônus que o indicador recebe quando um novo membro compra sua primeira licença, de R$ 5 para R$ 10.',
     1, 'active', 'financial', 40.00,
     CURRENT_TIMESTAMP + INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- 3. CURSOS DA ACADEMY (Estudar)
-- Inserir cursos de exemplo

INSERT INTO academy_courses (author_id, title, description, price, video_url, thumbnail_url, category, status)
VALUES
    (1, 'Fundamentos de Educação Financeira',
     'Aprenda os conceitos básicos de finanças pessoais: orçamento, poupança, juros compostos e planejamento.',
     0.00, 'https://www.youtube.com/watch?v=example1',
     'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600',
     'Finanças', 'APPROVED'),
    
    (1, 'Investindo do Zero ao Avançado',
     'Curso completo sobre investimentos: renda fixa, ações, fundos imobiliários e criptomoedas.',
     29.90, 'https://www.youtube.com/watch?v=example2',
     'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600',
     'Investimentos', 'APPROVED'),
    
    (1, 'Empreendedorismo Digital',
     'Como criar um negócio online lucrativo: e-commerce, dropshipping, afiliados e infoprodutos.',
     49.90, 'https://www.youtube.com/watch?v=example3',
     'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600',
     'Negócios', 'APPROVED'),
    
    (1, 'Marketing para Pequenos Negócios',
     'Estratégias de marketing de baixo custo para divulgar seu negócio local ou online.',
     19.90, 'https://www.youtube.com/watch?v=example4',
     'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=600',
     'Marketing', 'APPROVED')
ON CONFLICT DO NOTHING;

-- 4. PRODUTOS AFILIADOS (Loja)
-- Inserir produtos de parceiros para a loja

INSERT INTO products (title, description, image_url, affiliate_url, price, category, active)
VALUES
    ('Cartão de Crédito Nubank',
     'Cartão sem anuidade, aplicativo completo e rendimento automático.',
     'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600',
     'https://nubank.com.br/convite',
     0.00, 'Financeiro', true),
    
    ('Conta Digital Inter',
     'Conta 100% gratuita com cartão de débito, crédito e investimentos.',
     'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600',
     'https://inter.co/convite',
     0.00, 'Financeiro', true),
    
    ('Curso de Excel Avançado',
     'Domine o Excel e aumente suas chances no mercado de trabalho.',
     'https://images.unsplash.com/photo-1537432376149-e84978e88917?w=600',
     'https://hotmart.com/excel',
     97.00, 'Cursos', true),
    
    ('Empréstimo FGTS Caixa',
     'Antecipe seu FGTS com as menores taxas do mercado.',
     'https://images.unsplash.com/photo-1554224155-16974a4005d1?w=600',
     'https://caixa.gov.br/fgts',
     0.00, 'Financeiro', true)
ON CONFLICT DO NOTHING;

-- 5. ATUALIZAR CONFIGURAÇÃO DO SISTEMA
-- Garantir que as configurações estejam corretas

UPDATE system_config SET 
    quota_price = 100.00,
    loan_interest_rate = 0.20,
    penalty_rate = 0.40
WHERE id = 1;

-- Mensagem de sucesso
SELECT 'Seed completo! Dados de exemplo inseridos com sucesso.' as resultado;
