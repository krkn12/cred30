-- Script para atualizar o campo pix_key_to_receive de empréstimos existentes
-- Isso corrige o problema de "Pix Destino: Não informado" para empréstimos criados antes da correção

-- Atualizar empréstimos pendentes que não têm chave PIX
-- Substitua 'CHAVE_PIX_AQUI' pela chave PIX real do usuário
UPDATE loans 
SET pix_key_to_receive = 'josiassm701@gmail.com' 
WHERE id = 1 AND status = 'PENDING' AND (pix_key_to_receive IS NULL OR pix_key_to_receive = '');

-- Verificar se a atualização funcionou
SELECT id, user_id, amount, status, pix_key_to_receive FROM loans WHERE id = 1;