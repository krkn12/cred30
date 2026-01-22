-- RECOVERED SCHEMA FROM DEV --

CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL  ,
    name VARCHAR(255) NOT NULL ,
    email VARCHAR(255) NOT NULL ,
    password_hash VARCHAR(255) NOT NULL ,
    secret_phrase VARCHAR(255) NULL ,
    pix_key VARCHAR(255) NULL ,
    balance numeric NULL DEFAULT 0,
    referral_code VARCHAR(10) NULL ,
    referred_by VARCHAR(10) NULL ,
    is_admin boolean NULL DEFAULT false,
    score integer NULL DEFAULT 0,
    is_email_verified boolean NULL DEFAULT false,
    verification_code VARCHAR(10) NULL ,
    reset_password_token VARCHAR(255) NULL ,
    two_factor_secret text NULL ,
    two_factor_enabled boolean NULL DEFAULT false,
    accepted_terms_at timestamp without time zone NULL ,
    title_downloaded boolean NULL DEFAULT false,
    title_downloaded_at timestamp without time zone NULL ,
    role VARCHAR(20) NULL DEFAULT 'MEMBER'::character varying,
    status VARCHAR(20) NULL DEFAULT 'ACTIVE'::character varying,
    address text NULL ,
    phone VARCHAR(20) NULL ,
    is_seller boolean NULL DEFAULT false,
    seller_status VARCHAR(20) NULL DEFAULT 'none'::character varying,
    asaas_account_id VARCHAR(255) NULL ,
    asaas_wallet_id VARCHAR(255) NULL ,
    seller_company_name VARCHAR(255) NULL ,
    seller_cpf_cnpj VARCHAR(255) NULL ,
    seller_phone VARCHAR(255) NULL ,
    seller_address_street VARCHAR(255) NULL ,
    seller_address_number VARCHAR(255) NULL ,
    seller_address_neighborhood VARCHAR(255) NULL ,
    seller_address_city VARCHAR(255) NULL ,
    seller_address_state VARCHAR(255) NULL ,
    seller_address_postal_code VARCHAR(255) NULL ,
    seller_created_at timestamp without time zone NULL ,
    last_ip VARCHAR(45) NULL ,
    last_login_at timestamp without time zone NULL ,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    is_verified boolean NULL DEFAULT false,
    membership_type VARCHAR(20) NULL DEFAULT 'FREE'::character varying,
    last_reward_at timestamp without time zone NULL ,
    total_dividends_earned numeric NULL DEFAULT 0,
    security_lock_until timestamp without time zone NULL ,
    panic_phrase VARCHAR(255) NULL ,
    is_under_duress boolean NULL DEFAULT false,
    safe_contact_phone VARCHAR(20) NULL ,
    welcome_benefit_uses integer NULL DEFAULT 0,
    video_points integer NULL DEFAULT 0,
    ad_points integer NULL DEFAULT 0,
    last_checkin_at timestamp without time zone NULL ,
    cpf VARCHAR(14) NULL ,
    last_video_reward_at timestamp without time zone NULL ,
    pending_ad_points integer NULL DEFAULT 0,
    total_ad_points integer NULL DEFAULT 0,
    is_protected boolean NULL DEFAULT false,
    protection_expires_at timestamp without time zone NULL ,
    daily_chests_opened integer NULL DEFAULT 0,
    last_chest_date VARCHAR(10) NULL ,
    is_merchant boolean NULL DEFAULT false,
    merchant_name VARCHAR(100) NULL ,
    merchant_since timestamp with time zone NULL ,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.referral_codes (
    id SERIAL  ,
    code VARCHAR(20) NOT NULL ,
    created_by integer NULL ,
    max_uses integer NULL ,
    current_uses integer NULL DEFAULT 0,
    is_active boolean NULL DEFAULT true,
    is_verified boolean NULL DEFAULT false,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT referral_codes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.system_config (
    id SERIAL  ,
    system_balance numeric NULL DEFAULT 0,
    profit_pool numeric NULL DEFAULT 0,
    investment_reserve numeric NULL DEFAULT 0,
    total_gateway_costs numeric NULL DEFAULT 0,
    total_tax_reserve numeric NULL DEFAULT 0,
    total_operational_reserve numeric NULL DEFAULT 0,
    total_owner_profit numeric NULL DEFAULT 0,
    quota_price numeric NULL DEFAULT 100,
    loan_interest_rate numeric NULL DEFAULT 0.2,
    penalty_rate numeric NULL DEFAULT 0.4,
    vesting_period_ms bigint NULL DEFAULT '31536000000'::bigint,
    total_manual_costs numeric NULL DEFAULT 0,
    courier_price_per_km numeric NULL DEFAULT 2.50,
    updated_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    mutual_protection_fund numeric NULL DEFAULT 0,
    CONSTRAINT system_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.loans (
    id SERIAL  ,
    user_id integer NULL ,
    amount numeric NOT NULL ,
    interest_rate numeric NOT NULL ,
    penalty_rate numeric NULL DEFAULT 0.4,
    total_repayment numeric NOT NULL ,
    installments integer NULL DEFAULT 1,
    term_days integer NULL DEFAULT 30,
    status VARCHAR(20) NULL DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp without time zone NULL ,
    due_date timestamp without time zone NULL ,
    payout_status VARCHAR(20) NULL DEFAULT 'NONE'::character varying,
    pix_key_to_receive VARCHAR(255) NULL ,
    metadata jsonb NULL ,
    CONSTRAINT loans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL  ,
    user_id integer NULL ,
    type VARCHAR(20) NOT NULL ,
    amount numeric NOT NULL ,
    gateway_cost numeric NULL DEFAULT 0,
    description text NULL ,
    status VARCHAR(20) NULL DEFAULT 'PENDING'::character varying,
    metadata jsonb NULL ,
    payout_status VARCHAR(20) NULL DEFAULT 'NONE'::character varying,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone NULL ,
    CONSTRAINT transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL  ,
    user_id integer NULL ,
    title VARCHAR(255) NOT NULL ,
    message text NOT NULL ,
    type VARCHAR(50) NULL ,
    status VARCHAR(20) NULL DEFAULT 'UNREAD'::character varying,
    metadata jsonb NULL ,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.quotas (
    id SERIAL  ,
    user_id integer NULL ,
    purchase_price numeric NOT NULL ,
    current_value numeric NOT NULL ,
    purchase_date timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NULL DEFAULT 'ACTIVE'::character varying,
    yield_rate numeric NULL DEFAULT 0.5,
    CONSTRAINT quotas_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL  ,
    user_id integer NULL ,
    action VARCHAR(100) NOT NULL ,
    entity_type VARCHAR(50) NULL ,
    entity_id VARCHAR(100) NULL ,
    old_values jsonb NULL ,
    new_values jsonb NULL ,
    ip_address VARCHAR(45) NULL ,
    user_agent text NULL ,
    created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id SERIAL  ,
    provider VARCHAR(50) NOT NULL ,
    payload jsonb NOT NULL ,
    status VARCHAR(20) NULL DEFAULT 'PENDING'::character varying,
    error_message text NULL ,
    processed_at timestamp with time zone NULL ,
    created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT webhook_logs_pkey PRIMARY KEY (id)
);

