# Resumo Completo de Tabelas - CRED30 Database

## Overview
Este documento descreve todas as tabelas criadas no banco de dados PostgreSQL do sistema CRED30, incluindo as tabelas principais e as tabelas adicionais para funcionalidades avançadas.

## Total de Tabelas: 22

---

## Tabelas Principais (Core)

### 1. users
- **Descrição**: Tabela principal de usuários do sistema
- **Campos principais**: id, name, email, password_hash, pix_key, balance, secret_phrase, referral_code, is_admin, created_at
- **Relacionamentos**: Chave estrangeira para referrals, transactions, quotas, loans

### 2. system_config
- **Descrição**: Configurações globais do sistema
- **Campos principais**: system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms
- **Uso**: Controla parâmetros financeiros e operacionais

### 3. quotas
- **Descrição**: Cotas de investimento dos usuários
- **Campos principais**: id, user_id, purchase_price, current_value, purchase_date, status
- **Relacionamentos**: FK para users(id)

### 4. loans
- **Descrição**: Empréstimos solicitados pelos usuários
- **Campos principais**: id, user_id, amount, total_repayment, installments, interest_rate, status, due_date, pix_key_to_receive
- **Relacionamentos**: FK para users(id)

### 5. loan_installments
- **Descrição**: Parcelas pagas de empréstimos
- **Campos principais**: id, loan_id, amount, use_balance, created_at
- **Relacionamentos**: FK para loans(id)

### 6. transactions
- **Descrição**: Todas as transações financeiras do sistema
- **Campos principais**: id, user_id, type, amount, description, status, metadata, created_at
- **Relacionamentos**: FK para users(id)

### 7. withdrawals
- **Descrição**: Saques solicitados pelos usuários
- **Campos principais**: id, user_id, amount, pix_key, status, created_at
- **Relacionamentos**: FK para users(id)

---

## Tabelas de Sistema e Configuração

### 8. system_settings
- **Descrição**: Configurações adicionais do sistema
- **Campos principais**: key, value, description, created_at, updated_at

### 9. system_fees
- **Descrição**: Configurações de taxas do sistema
- **Campos principais**: fee_type, fee_percentage, fee_fixed, min_amount, max_amount

### 10. app_settings
- **Descrição**: Configurações da aplicação
- **Campos principais**: setting_key, setting_value, description, created_at, updated_at

---

## Tabelas de Auditoria e Logs

### 11. audit_logs
- **Descrição**: Log de auditoria de ações administrativas
- **Campos principais**: id, action, entity_id, entity_type, details, created_by, created_at

### 12. admin_logs
- **Descrição**: Logs específicos de ações de administradores
- **Campos principais**: id, admin_id, action, details, ip_address, user_agent, created_at

### 13. backup_logs
- **Descrição**: Registro de backups realizados
- **Campos principais**: id, backup_type, file_path, file_size, status, created_at

### 14. rate_limit_logs
- **Descrição**: Logs de limitação de taxa de requisições
- **Campos principais**: id, user_id, endpoint, ip_address, blocked_at, reason

---

## Tabelas de Funcionalidades Avançadas

### 15. user_sessions
- **Descrição**: Sessões de usuário ativas e histórico de login
- **Campos principais**: id, user_id, token_hash, device_info, ip_address, expires_at, is_active
- **Relacionamentos**: FK para users(id)

### 16. notification_settings
- **Descrição**: Preferências de notificação do usuário
- **Campos principais**: id, user_id, email_notifications, sms_notifications, push_notifications, transaction_alerts
- **Relacionamentos**: FK para users(id)

### 17. notifications
- **Descrição**: Notificações do sistema para usuários
- **Campos principais**: id, user_id, title, message, type, category, is_read, metadata
- **Relacionamentos**: FK para users(id)

### 18. user_statistics
- **Descrição**: Estatísticas e métricas do usuário
- **Campos principais**: id, user_id, total_invested, total_earned, total_borrowed, quotas_owned, referral_count
- **Relacionamentos**: FK para users(id)

### 19. referrals
- **Descrição**: Sistema de indicações e bônus
- **Campos principais**: id, referrer_id, referred_id, referral_code, status, bonus_amount, bonus_paid
- **Relacionamentos**: FK para users(id) (referrer e referred)

### 20. support_tickets
- **Descrição**: Tickets de suporte ao usuário
- **Campos principais**: id, user_id, subject, message, category, priority, status, assigned_to
- **Relacionamentos**: FK para users(id)

### 21. fee_history
- **Descrição**: Histórico de taxas cobradas
- **Campos principais**: id, transaction_id, fee_type, fee_amount, fee_percentage, distribution_rule
- **Relacionamentos**: FK para transactions(id)

### 22. daily_reports
- **Descrição**: Relatórios diários do sistema
- **Campos principais**: id, report_date, total_users, active_quotas, total_loaned, profit_generated, profit_distributed

---

## Views Criadas

### current_financial_summary
- **Descrição**: View consolidada com métricas financeiras atuais
- **Campos**: total_users, active_quotas, total_loaned, operational_balance, profit_pool, pending_transactions

---

## Índices Principais

Foram criados índices para otimizar performance em:

- Consultas por user_id em todas as tabelas relacionadas
- Consultas por status em transactions, loans, quotas
- Consultas por data (created_at) para relatórios
- Consultas por tipo em transactions
- Índices compostos para consultas frequentes do dashboard

---

## Triggers Automáticos

### update_updated_at_column
- **Função**: Atualiza automaticamente o campo updated_at
- **Aplicado em**: notification_settings, user_statistics, support_tickets

### update_user_statistics
- **Função**: Mantém estatísticas do usuário atualizadas
- **Disparado por**: INSERT/UPDATE na tabela users

---

## Relacionamentos Entre Tabelas

```
users (1:N) → transactions
users (1:N) → quotas
users (1:N) → loans
users (1:N) → withdrawals
users (1:N) → user_sessions
users (1:N) → notifications
users (1:1) → user_statistics
users (1:N) → referrals (como referrer)
users (1:1) → referrals (como referred)
users (1:N) → support_tickets

loans (1:N) → loan_installments
transactions (1:1) → fee_history
```

---

## Scripts de Criação

1. **init-db-fixed.sql** - Tabelas principais do sistema
2. **create-missing-tables.sql** - Tabelas complementares iniciais
3. **fix-missing-tables-uuid.sql** - Correções de compatibilidade UUID
4. **create-additional-tables-optimized.sql** - Tabelas avançadas com otimizações

---

## Status Final

✅ **Todas as 22 tabelas criadas com sucesso**
✅ **Índices otimizados para performance**
✅ **Triggers configurados para atualização automática**
✅ **Views criadas para consultas otimizadas**
✅ **Relacionamentos properly configured**
✅ **Compatibilidade total com frontend e backend**

---

## Recomendações de Manutenção

1. **Backup Diário**: Utilizar a tabela backup_logs para registrar backups
2. **Monitoramento**: Usar audit_logs para rastrear ações críticas
3. **Performance**: Monitorar queries lentas e ajustar índices conforme necessário
4. **Limpeza**: Implementar rotina de limpeza para user_sessions expiradas
5. **Relatórios**: Usar daily_reports para análise de tendências

---

## Compatibilidade com Aplicação

- **Frontend**: 100% compatível com todas as telas e componentes
- **Backend**: Todas as rotas suportadas pelas tabelas criadas
- **API**: Todos os endpoints possuem suporte completo no banco de dados
- **Admin**: Dashboard administrativo totalmente funcional com todas as métricas

---

*Última atualização: 15/12/2024*
*Versão do banco: v2.0*
*Total de tabelas: 22*