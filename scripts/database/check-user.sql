-- Verificar se o usuário josiassm701@gmail.com existe no banco
SELECT id, name, email, password, secret_phrase, pix_key, balance, created_at, referral_code, is_admin 
FROM users 
WHERE email = 'josiassm701@gmail.com';

-- Listar todos os usuários
SELECT id, name, email, is_admin 
FROM users 
ORDER BY created_at DESC;

-- Listar transações pendentes
SELECT id, type, amount, user_id, status, created_at 
FROM transactions 
WHERE status = 'PENDING'
ORDER BY created_at DESC;