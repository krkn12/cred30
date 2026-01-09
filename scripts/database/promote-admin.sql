-- =====================================================
-- PROMOVER USUÁRIO EXISTENTE A ADMINISTRADOR - CRED30
-- =====================================================
-- Execute este script para promover um usuário existente a admin

-- Promover usuário pelo email
UPDATE users 
SET 
    is_admin = true,
    role = 'ADMIN',
    balance = 1000.00,
    score = 1000,
    updated_at = NOW()
WHERE email = 'josiassm701@gmail.com';

-- Verificação
DO $$
DECLARE
    user_count INTEGER;
    admin_email VARCHAR;
    user_name VARCHAR;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE is_admin = true;
    SELECT email, name INTO admin_email, user_name FROM users WHERE is_admin = true AND email = 'josiassm701@gmail.com';
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'USUÁRIO PROMOVIDO A ADMINISTRADOR!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Email: %', admin_email;
    RAISE NOTICE 'Nome: %', user_name;
    RAISE NOTICE 'Total de admins no sistema: %', user_count;
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'FAÇA LOGOUT E LOGIN NOVAMENTE PARA ATUALIZAR O TOKEN';
    RAISE NOTICE '===========================================';
END $$;

-- Mostrar dados do admin
SELECT 
    id,
    email,
    name,
    is_admin,
    role,
    balance,
    score,
    status,
    created_at
FROM users 
WHERE email = 'josiassm701@gmail.com';
