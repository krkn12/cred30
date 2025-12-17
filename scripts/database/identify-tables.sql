-- =============================================================================
-- SCRIPT DE IDENTIFICAÇÃO DE TABELAS PARA LIMPEZA DE DADOS
-- =============================================================================
-- Este script identifica todas as tabelas do banco e classifica quanto à necessidade de limpeza
-- =============================================================================

-- Extensão necessária para consultas avançadas
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- 1. LISTA COMPLETA DE TABELAS DO BANCO
-- =============================================================================
SELECT 
    t.table_schema,
    t.table_name,
    t.table_type,
    pg_size_pretty(pg_total_relation_size(t.table_name::regclass)) AS table_size,
    COALESCE(s.n_tup_ins, 0) AS total_inserts,
    COALESCE(s.n_tup_upd, 0) AS total_updates,
    COALESCE(s.n_tup_del, 0) AS total_deletes,
    COALESCE(s.n_live_tup, 0) AS live_rows,
    COALESCE(s.n_dead_tup, 0) AS dead_rows
FROM 
    information_schema.tables t
LEFT JOIN 
    pg_stat_user_tables s ON s.relname = t.table_name
WHERE 
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY 
    t.table_name;

-- =============================================================================
-- 2. ANÁLISE DETAÇHADA DAS TABELAS PRINCIPAIS
-- =============================================================================

-- Tabela de Usuários
SELECT 
    'users' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN is_admin = TRUE THEN 1 END) AS admin_users,
    COUNT(CASE WHEN is_admin = FALSE THEN 1 END) AS regular_users,
    COUNT(CASE WHEN email = 'josiassm701@gmail.com' THEN 1 END) AS primary_admin_exists,
    MIN(created_at) AS oldest_record,
    MAX(created_at) AS newest_record,
    SUM(balance) AS total_balance,
    SUM(total_invested) AS total_invested
FROM users;

-- Tabela de Cotas (Quotas)
SELECT 
    'quotas' AS table_name,
    COUNT(*) AS total_records,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(quantity) AS total_quotas,
    SUM(total_amount) AS total_amount,
    SUM(purchase_price) AS total_purchase_value,
    SUM(current_value) AS total_current_value,
    COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_quotas,
    COUNT(CASE WHEN status != 'active' THEN 1 END) AS inactive_quotas,
    MIN(purchase_date) AS oldest_purchase,
    MAX(purchase_date) AS newest_purchase
FROM quotas;

-- Tabela de Empréstimos (Loans)
SELECT 
    'loans' AS table_name,
    COUNT(*) AS total_records,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(amount) AS total_loan_amount,
    SUM(total_repayment) AS total_repayment_amount,
    AVG(interest_rate) AS avg_interest_rate,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_loans,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_loans,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_loans,
    COUNT(CASE WHEN status = 'defaulted' THEN 1 END) AS defaulted_loans,
    MIN(created_at) AS oldest_loan,
    MAX(created_at) AS newest_loan
FROM loans;

-- Tabela de Parcelas de Empréstimos
SELECT 
    'loan_installments' AS table_name,
    COUNT(*) AS total_records,
    COUNT(DISTINCT loan_id) AS unique_loans,
    SUM(amount) AS total_installment_amount,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_installments,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_installments,
    COUNT(CASE WHEN status = 'overdue' THEN 1 END) AS overdue_installments,
    MIN(due_date) AS earliest_due_date,
    MAX(due_date) AS latest_due_date
FROM loan_installments;

-- Tabela de Transações
SELECT 
    'transactions' AS table_name,
    COUNT(*) AS total_records,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(amount) AS total_transaction_amount,
    COUNT(CASE WHEN type = 'deposit' THEN 1 END) AS deposits,
    COUNT(CASE WHEN type = 'withdrawal' THEN 1 END) AS withdrawals,
    COUNT(CASE WHEN type = 'transfer' THEN 1 END) AS transfers,
    COUNT(CASE WHEN type = 'loan_payment' THEN 1 END) AS loan_payments,
    COUNT(CASE WHEN type = 'investment' THEN 1 END) AS investments,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_transactions,
    COUNT(CASE WHEN status != 'completed' THEN 1 END) AS pending_transactions,
    MIN(created_at) AS oldest_transaction,
    MAX(created_at) AS newest_transaction
FROM transactions;

-- Tabela de Saques (Withdrawals)
SELECT 
    'withdrawals' AS table_name,
    COUNT(*) AS total_records,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(amount) AS total_withdrawal_amount,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_withdrawals,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_withdrawals,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_withdrawals,
    COUNT(CASE WHEN status = 'processed' THEN 1 END) AS processed_withdrawals,
    MIN(created_at) AS oldest_withdrawal,
    MAX(created_at) AS newest_withdrawal
FROM withdrawals;

-- Tabela de Configurações do Sistema
SELECT 
    'app_settings' AS table_name,
    COUNT(*) AS total_records,
    STRING_AGG(key, ', ' ORDER BY key) AS all_settings,
    MIN(updated_at) AS oldest_update,
    MAX(updated_at) AS newest_update
FROM app_settings;

-- =============================================================================
-- 3. CLASSIFICAÇÃO DAS TABELAS QUANTO À NECESSIDADE DE LIMPEZA
-- =============================================================================

-- Tabelas que devem ser LIMPADAS (dados de usuários e transações)
SELECT 
    'CLEAN' AS action_required,
    table_name,
    'User and transaction data - must be cleaned' AS reason,
    'DELETE FROM ' || table_name || ';' AS cleanup_command
FROM (
    SELECT 'users' AS table_name UNION
    SELECT 'quotas' UNION
    SELECT 'loans' UNION
    SELECT 'loan_installments' UNION
    SELECT 'transactions' UNION
    SELECT 'withdrawals'
) AS tables_to_clean
UNION ALL

-- Tabelas que devem ser PRESERVADAS (configurações e sistema)
SELECT 
    'PRESERVE' AS action_required,
    table_name,
    'System configuration - must be preserved' AS reason,
    'DO NOT DELETE - Preserve data' AS cleanup_command
FROM (
    SELECT 'app_settings' AS table_name
) AS tables_to_preserve

UNION ALL

-- Tabelas que precisam de LIMPEZA SELETIVA (preservar admin)
SELECT 
    'SELECTIVE_CLEAN' AS action_required,
    'users' AS table_name,
    'Preserve admin user (josiassm701@gmail.com), delete others' AS reason,
    'DELETE FROM users WHERE email != ''josiassm701@gmail.com'';' AS cleanup_command;

-- =============================================================================
-- 4. VERIFICAÇÃO DE INTEGRIDADE REFERENCIAL
-- =============================================================================

-- Verificar todas as foreign keys
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM 
    information_schema.table_constraints AS tc 
JOIN 
    information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN 
    information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY 
    tc.table_name;

-- =============================================================================
-- 5. ANÁLISE DE DEPENDÊNCIAS ENTRE TABELAS
-- =============================================================================

-- Ordem recomendado para deleção (respeitando foreign keys)
WITH table_dependencies AS (
    SELECT 
        tc.table_name AS dependent_table,
        ccu.table_name AS referenced_table,
        tc.constraint_name
    FROM 
        information_schema.table_constraints tc
    JOIN 
        information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
    WHERE 
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
)
SELECT 
    'Deletion Order' AS information_type,
    dependent_table,
    referenced_table,
    constraint_name,
    CASE 
        WHEN referenced_table IN ('users') THEN 1
        WHEN referenced_table IN ('loans') THEN 2
        WHEN referenced_table IN ('quotas') THEN 3
        ELSE 4
    END AS deletion_priority
FROM table_dependencies
ORDER BY deletion_priority, dependent_table;

-- =============================================================================
-- 6. RESUMO ESTATÍSTICO FINAL
-- =============================================================================

SELECT 
    'SUMMARY' AS section,
    'Total Tables' AS metric,
    COUNT(*)::text AS value
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
    'SUMMARY' AS section,
    'Tables to Clean' AS metric,
    '6' AS value

UNION ALL

SELECT 
    'SUMMARY' AS section,
    'Tables to Preserve' AS metric,
    '1' AS value

UNION ALL

SELECT 
    'SUMMARY' AS section,
    'Selective Clean Required' AS metric,
    '1' AS value

UNION ALL

SELECT 
    'SUMMARY' AS section,
    'Primary Admin to Preserve' AS metric,
    'josiassm701@gmail.com' AS value;