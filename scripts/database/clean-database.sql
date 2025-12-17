-- Script para limpar completamente o banco de dados
-- Execute este script no PostgreSQL para limpar todas as tabelas

-- Limpar todas as tabelas em ordem correta (respeitando foreign keys)
DELETE FROM transactions;
DELETE FROM loans;
DELETE FROM quotas;
DELETE FROM admin_logs;
DELETE FROM rate_limit_logs;
DELETE FROM system_config;
DELETE FROM users;

-- Resetar sequências
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE loans_id_seq RESTART WITH 1;
ALTER SEQUENCE quotas_id_seq RESTART WITH 1;
ALTER SEQUENCE admin_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE rate_limit_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE system_config_id_seq RESTART WITH 1;

-- Confirmar que o banco está limpo
SELECT 'Banco de dados limpo com sucesso!' as status;