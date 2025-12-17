-- =====================================================
-- CRIAÇÃO DE USUÁRIO ADMINISTRADOR - CRED30
-- =====================================================
-- Script para criar um usuário admin após limpeza completa
-- =====================================================

-- Inserir administrador principal
INSERT INTO users (
    id, 
    email, 
    password_hash, 
    name, 
    secret_phrase, 
    pix_key, 
    referral_code, 
    is_admin, 
    role, 
    balance, 
    total_invested, 
    created_at, 
    updated_at
) VALUES (
    gen_random_uuid(), 
    'josiassm701@gmail.com', 
    '$2b$10$YourHashedPasswordHere', 
    'Administrador Principal', 
    'admin123', 
    'admin@pix.com', 
    'ADMIN001', 
    true, 
    'admin', 
    0.00, 
    0.00, 
    NOW(), 
    NOW()
);

-- Verificação
DO $$
DECLARE
    user_count INTEGER;
    admin_email VARCHAR;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE is_admin = true;
    SELECT email INTO admin_email FROM users WHERE is_admin = true LIMIT 1;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'ADMINISTRADOR CRIADO COM SUCESSO!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total de admins: %', user_count;
    RAISE NOTICE 'Email do admin: %', admin_email;
    RAISE NOTICE 'Senha temporária: admin123';
    RAISE NOTICE '===========================================';
END $$;

-- Mostrar dados do admin criado
SELECT 
    id,
    email,
    name,
    is_admin,
    role,
    balance,
    total_invested,
    created_at
FROM users 
WHERE is_admin = true;