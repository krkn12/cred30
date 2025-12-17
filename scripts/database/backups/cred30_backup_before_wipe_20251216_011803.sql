--
-- PostgreSQL database dump
--

\restrict s93bod2JFOe3TdmsZHAhowX193UabKEfxyBI2Td1fSKcaLR4KMZSprPp53sXZAW

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: cred30user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO cred30user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.admin_logs (
    id integer NOT NULL,
    admin_id uuid,
    action character varying(50) NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id character varying(50),
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admin_logs OWNER TO cred30user;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.admin_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admin_logs_id_seq OWNER TO cred30user;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.admin_logs_id_seq OWNED BY public.admin_logs.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.app_settings (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_settings OWNER TO cred30user;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    action character varying(100) NOT NULL,
    entity_id integer,
    entity_type character varying(50),
    details text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO cred30user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO cred30user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.backup_logs (
    id integer NOT NULL,
    backup_type character varying(50) NOT NULL,
    file_path text,
    file_size bigint,
    status character varying(20) DEFAULT 'STARTED'::character varying,
    error_message text,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    CONSTRAINT backup_logs_backup_type_check CHECK (((backup_type)::text = ANY ((ARRAY['FULL'::character varying, 'INCREMENTAL'::character varying, 'DIFFERENTIAL'::character varying])::text[]))),
    CONSTRAINT backup_logs_status_check CHECK (((status)::text = ANY ((ARRAY['STARTED'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.backup_logs OWNER TO cred30user;

--
-- Name: backup_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.backup_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.backup_logs_id_seq OWNER TO cred30user;

--
-- Name: backup_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.backup_logs_id_seq OWNED BY public.backup_logs.id;


--
-- Name: daily_reports; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.daily_reports (
    id integer NOT NULL,
    report_date date NOT NULL,
    total_users integer DEFAULT 0,
    active_quotas integer DEFAULT 0,
    total_loaned numeric(15,2) DEFAULT 0.00,
    total_received numeric(15,2) DEFAULT 0.00,
    profit_pool numeric(15,2) DEFAULT 0.00,
    system_balance numeric(15,2) DEFAULT 0.00,
    new_users integer DEFAULT 0,
    loans_approved integer DEFAULT 0,
    loans_rejected integer DEFAULT 0,
    quotas_sold integer DEFAULT 0,
    quotas_bought integer DEFAULT 0,
    withdrawals_processed integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.daily_reports OWNER TO cred30user;

--
-- Name: TABLE daily_reports; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.daily_reports IS 'Relatórios diários do sistema';


--
-- Name: daily_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.daily_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.daily_reports_id_seq OWNER TO cred30user;

--
-- Name: daily_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.daily_reports_id_seq OWNED BY public.daily_reports.id;


--
-- Name: fee_history; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.fee_history (
    id integer NOT NULL,
    transaction_id uuid NOT NULL,
    fee_type character varying(50) NOT NULL,
    fee_amount numeric(15,2) NOT NULL,
    fee_percentage numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.fee_history OWNER TO cred30user;

--
-- Name: TABLE fee_history; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.fee_history IS 'Histórico de taxas cobradas';


--
-- Name: fee_history_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.fee_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.fee_history_id_seq OWNER TO cred30user;

--
-- Name: fee_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.fee_history_id_seq OWNED BY public.fee_history.id;


--
-- Name: loan_installments; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.loan_installments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    loan_id uuid,
    installment_number integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    due_date timestamp without time zone NOT NULL,
    paid_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    use_balance boolean DEFAULT false
);


ALTER TABLE public.loan_installments OWNER TO cred30user;

--
-- Name: loans; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.loans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    amount numeric(15,2) NOT NULL,
    interest_rate numeric(5,4) NOT NULL,
    penalty_rate numeric(5,4) NOT NULL,
    term_days integer NOT NULL,
    total_repayment numeric(15,2) NOT NULL,
    installments integer DEFAULT 1,
    status character varying(50) DEFAULT 'pending'::character varying,
    approved_at timestamp without time zone,
    due_date timestamp without time zone,
    pix_key_to_receive character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.loans OWNER TO cred30user;

--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.notification_settings (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    email_notifications boolean DEFAULT true,
    sms_notifications boolean DEFAULT false,
    push_notifications boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_settings OWNER TO cred30user;

--
-- Name: TABLE notification_settings; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.notification_settings IS 'Preferências de notificação do usuário';


--
-- Name: notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.notification_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notification_settings_id_seq OWNER TO cred30user;

--
-- Name: notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.notification_settings_id_seq OWNED BY public.notification_settings.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO cred30user;

--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.notifications IS 'Notificações do sistema para usuários';


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notifications_id_seq OWNER TO cred30user;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: quotas; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.quotas (
    id integer NOT NULL,
    user_id uuid,
    purchase_price numeric(10,2) NOT NULL,
    current_value numeric(10,2) NOT NULL,
    purchase_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'ACTIVE'::character varying
);


ALTER TABLE public.quotas OWNER TO cred30user;

--
-- Name: quotas_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.quotas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quotas_id_seq OWNER TO cred30user;

--
-- Name: quotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.quotas_id_seq OWNED BY public.quotas.id;


--
-- Name: rate_limit_logs; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.rate_limit_logs (
    id integer NOT NULL,
    identifier character varying(100) NOT NULL,
    user_id integer,
    count integer NOT NULL,
    ip_address text,
    user_agent text,
    endpoint character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rate_limit_logs OWNER TO cred30user;

--
-- Name: rate_limit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.rate_limit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.rate_limit_logs_id_seq OWNER TO cred30user;

--
-- Name: rate_limit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.rate_limit_logs_id_seq OWNED BY public.rate_limit_logs.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    referrer_id uuid NOT NULL,
    referred_id uuid NOT NULL,
    referral_code character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    bonus_amount numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.referrals OWNER TO cred30user;

--
-- Name: TABLE referrals; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.referrals IS 'Sistema de indicações e bônus';


--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.referrals_id_seq OWNER TO cred30user;

--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    subject character varying(255) NOT NULL,
    message text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.support_tickets OWNER TO cred30user;

--
-- Name: TABLE support_tickets; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.support_tickets IS 'Tickets de suporte ao usuário';


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.support_tickets_id_seq OWNER TO cred30user;

--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.system_config (
    id integer NOT NULL,
    system_balance numeric(15,2) DEFAULT 0,
    profit_pool numeric(15,2) DEFAULT 0,
    quota_price numeric(10,2) DEFAULT 100,
    loan_interest_rate numeric(5,2) DEFAULT 0.2,
    penalty_rate numeric(5,2) DEFAULT 0.4,
    vesting_period_ms bigint DEFAULT '31536000000'::bigint,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_config OWNER TO cred30user;

--
-- Name: system_config_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.system_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_config_id_seq OWNER TO cred30user;

--
-- Name: system_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.system_config_id_seq OWNED BY public.system_config.id;


--
-- Name: system_fees; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.system_fees (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    fee_type character varying(20) NOT NULL,
    fee_value numeric(10,4) NOT NULL,
    min_fee numeric(10,2) DEFAULT 0.00,
    max_fee numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT system_fees_fee_type_check CHECK (((fee_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'FIXED'::character varying, 'HYBRID'::character varying])::text[]))),
    CONSTRAINT system_fees_type_check CHECK (((type)::text = ANY ((ARRAY['WITHDRAWAL'::character varying, 'LOAN'::character varying, 'TRANSFER'::character varying, 'PENALTY'::character varying])::text[])))
);


ALTER TABLE public.system_fees OWNER TO cred30user;

--
-- Name: system_fees_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.system_fees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_fees_id_seq OWNER TO cred30user;

--
-- Name: system_fees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.system_fees_id_seq OWNED BY public.system_fees.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    description text,
    is_public boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_settings OWNER TO cred30user;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_settings_id_seq OWNER TO cred30user;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    type character varying(50) NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    reference_id uuid,
    status character varying(50) DEFAULT 'completed'::character varying,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.transactions OWNER TO cred30user;

--
-- Name: user_financial_summary; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.user_financial_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    current_balance numeric(15,2) DEFAULT 0,
    total_quota_value numeric(15,2) DEFAULT 0,
    total_loan_debt numeric(15,2) DEFAULT 0,
    available_credit numeric(15,2) DEFAULT 0,
    total_earned numeric(15,2) DEFAULT 0,
    total_spent numeric(15,2) DEFAULT 0,
    last_calculated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_financial_summary OWNER TO cred30user;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    session_token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_sessions OWNER TO cred30user;

--
-- Name: TABLE user_sessions; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.user_sessions IS 'Sessões de usuário ativas e histórico de login';


--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_sessions_id_seq OWNER TO cred30user;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: user_statistics; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.user_statistics (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    total_invested numeric(15,2) DEFAULT 0,
    total_withdrawn numeric(15,2) DEFAULT 0,
    total_earned numeric(15,2) DEFAULT 0,
    active_quotas integer DEFAULT 0,
    total_loans integer DEFAULT 0,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_statistics OWNER TO cred30user;

--
-- Name: TABLE user_statistics; Type: COMMENT; Schema: public; Owner: cred30user
--

COMMENT ON TABLE public.user_statistics IS 'Estatísticas e métricas do usuário';


--
-- Name: user_statistics_id_seq; Type: SEQUENCE; Schema: public; Owner: cred30user
--

CREATE SEQUENCE public.user_statistics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_statistics_id_seq OWNER TO cred30user;

--
-- Name: user_statistics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cred30user
--

ALTER SEQUENCE public.user_statistics_id_seq OWNED BY public.user_statistics.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    secret_phrase character varying(255) NOT NULL,
    pix_key character varying(255) NOT NULL,
    referral_code character varying(20) NOT NULL,
    is_admin boolean DEFAULT false,
    role character varying(50) DEFAULT 'client'::character varying,
    balance numeric(15,2) DEFAULT 0.00,
    total_invested numeric(15,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    referred_by uuid
);


ALTER TABLE public.users OWNER TO cred30user;

--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: cred30user
--

CREATE TABLE public.withdrawals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    amount numeric(15,2) NOT NULL,
    pix_key character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.withdrawals OWNER TO cred30user;

--
-- Name: admin_logs id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.admin_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_logs_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: backup_logs id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.backup_logs ALTER COLUMN id SET DEFAULT nextval('public.backup_logs_id_seq'::regclass);


--
-- Name: daily_reports id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.daily_reports ALTER COLUMN id SET DEFAULT nextval('public.daily_reports_id_seq'::regclass);


--
-- Name: fee_history id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.fee_history ALTER COLUMN id SET DEFAULT nextval('public.fee_history_id_seq'::regclass);


--
-- Name: notification_settings id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.notification_settings ALTER COLUMN id SET DEFAULT nextval('public.notification_settings_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: quotas id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.quotas ALTER COLUMN id SET DEFAULT nextval('public.quotas_id_seq'::regclass);


--
-- Name: rate_limit_logs id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.rate_limit_logs ALTER COLUMN id SET DEFAULT nextval('public.rate_limit_logs_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: system_config id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.system_config ALTER COLUMN id SET DEFAULT nextval('public.system_config_id_seq'::regclass);


--
-- Name: system_fees id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.system_fees ALTER COLUMN id SET DEFAULT nextval('public.system_fees_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: user_statistics id; Type: DEFAULT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_statistics ALTER COLUMN id SET DEFAULT nextval('public.user_statistics_id_seq'::regclass);


--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.admin_logs (id, admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.app_settings (key, value, description, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.audit_logs (id, action, entity_id, entity_type, details, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: backup_logs; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.backup_logs (id, backup_type, file_path, file_size, status, error_message, started_at, completed_at) FROM stdin;
\.


--
-- Data for Name: daily_reports; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.daily_reports (id, report_date, total_users, active_quotas, total_loaned, total_received, profit_pool, system_balance, new_users, loans_approved, loans_rejected, quotas_sold, quotas_bought, withdrawals_processed, created_at) FROM stdin;
\.


--
-- Data for Name: fee_history; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.fee_history (id, transaction_id, fee_type, fee_amount, fee_percentage, created_at) FROM stdin;
\.


--
-- Data for Name: loan_installments; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.loan_installments (id, loan_id, installment_number, amount, due_date, paid_at, status, created_at, updated_at, use_balance) FROM stdin;
\.


--
-- Data for Name: loans; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.loans (id, user_id, amount, interest_rate, penalty_rate, term_days, total_repayment, installments, status, approved_at, due_date, pix_key_to_receive, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.notification_settings (id, user_id, email_notifications, sms_notifications, push_notifications, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.notifications (id, user_id, title, message, type, read, created_at) FROM stdin;
\.


--
-- Data for Name: quotas; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.quotas (id, user_id, purchase_price, current_value, purchase_date, status) FROM stdin;
\.


--
-- Data for Name: rate_limit_logs; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.rate_limit_logs (id, identifier, user_id, count, ip_address, user_agent, endpoint, created_at) FROM stdin;
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.referrals (id, referrer_id, referred_id, referral_code, status, bonus_amount, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.support_tickets (id, user_id, subject, message, status, priority, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_config; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.system_config (id, system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms, updated_at, created_at) FROM stdin;
2	0.00	0.00	50.00	0.20	0.40	2592000000	2025-12-16 00:15:57.155215	2025-12-16 00:15:57.155215
\.


--
-- Data for Name: system_fees; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.system_fees (id, name, type, fee_type, fee_value, min_fee, max_fee, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.system_settings (id, key, value, description, is_public, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.transactions (id, user_id, type, amount, description, reference_id, status, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_financial_summary; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.user_financial_summary (id, user_id, current_balance, total_quota_value, total_loan_debt, available_credit, total_earned, total_spent, last_calculated_at) FROM stdin;
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.user_sessions (id, user_id, session_token, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_statistics; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.user_statistics (id, user_id, total_invested, total_withdrawn, total_earned, active_quotas, total_loans, last_activity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.users (id, name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, role, balance, total_invested, created_at, updated_at, referred_by) FROM stdin;
8ed3d01d-2bad-40e0-98a3-79f7ee19409e	josias	josiassm701@gmail.co	$2b$10$zYUqdgsq9m0mzYVktnup9evbnmxaZFzS4JL6S5iG2Etw4vYGB.3zW	32588589	01558516247	23JWK1	t	client	0.00	0.00	2025-12-16 00:32:48.37994	2025-12-16 00:32:48.37994	\N
657af72f-c127-41bc-a80b-97a2bd3240a0	josias	josiassm701@gmail.com	$2b$10$PTVHRPwaAKSzx1LYwqK6k.MFQ9Mp4Eo0rHFMi9kx46L724Mpt1o..	32588589	01558516247	W1DP8W	f	client	0.00	0.00	2025-12-16 02:40:05.964986	2025-12-16 02:40:05.964986	\N
\.


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: cred30user
--

COPY public.withdrawals (id, user_id, amount, pix_key, status, processed_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: admin_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.admin_logs_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: backup_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.backup_logs_id_seq', 1, false);


--
-- Name: daily_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.daily_reports_id_seq', 1, false);


--
-- Name: fee_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.fee_history_id_seq', 1, false);


--
-- Name: notification_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.notification_settings_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: quotas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.quotas_id_seq', 1, false);


--
-- Name: rate_limit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.rate_limit_logs_id_seq', 1, false);


--
-- Name: referrals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.referrals_id_seq', 1, false);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 1, false);


--
-- Name: system_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.system_config_id_seq', 2, true);


--
-- Name: system_fees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.system_fees_id_seq', 1, false);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, false);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 1, false);


--
-- Name: user_statistics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: cred30user
--

SELECT pg_catalog.setval('public.user_statistics_id_seq', 1, false);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_pkey PRIMARY KEY (id);


--
-- Name: daily_reports daily_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_pkey PRIMARY KEY (id);


--
-- Name: daily_reports daily_reports_report_date_key; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_report_date_key UNIQUE (report_date);


--
-- Name: fee_history fee_history_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.fee_history
    ADD CONSTRAINT fee_history_pkey PRIMARY KEY (id);


--
-- Name: loan_installments loan_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.loan_installments
    ADD CONSTRAINT loan_installments_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: quotas quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.quotas
    ADD CONSTRAINT quotas_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_logs rate_limit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.rate_limit_logs
    ADD CONSTRAINT rate_limit_logs_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);


--
-- Name: system_fees system_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.system_fees
    ADD CONSTRAINT system_fees_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_financial_summary user_financial_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_financial_summary
    ADD CONSTRAINT user_financial_summary_pkey PRIMARY KEY (id);


--
-- Name: user_financial_summary user_financial_summary_user_id_key; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_financial_summary
    ADD CONSTRAINT user_financial_summary_user_id_key UNIQUE (user_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: user_statistics user_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_statistics
    ADD CONSTRAINT user_statistics_pkey PRIMARY KEY (id);


--
-- Name: user_statistics user_statistics_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_statistics
    ADD CONSTRAINT user_statistics_user_id_unique UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_logs_admin_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs USING btree (admin_id);


--
-- Name: idx_admin_logs_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_admin_logs_created_at ON public.admin_logs USING btree (created_at);


--
-- Name: idx_admin_logs_entity; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_admin_logs_entity ON public.admin_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_created_by; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_audit_logs_created_by ON public.audit_logs USING btree (created_by);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_daily_reports_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_daily_reports_created_at ON public.daily_reports USING btree (created_at DESC);


--
-- Name: idx_daily_reports_date; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_daily_reports_date ON public.daily_reports USING btree (report_date DESC);


--
-- Name: idx_daily_reports_report_date; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_daily_reports_report_date ON public.daily_reports USING btree (report_date);


--
-- Name: idx_fee_history_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_fee_history_created_at ON public.fee_history USING btree (created_at);


--
-- Name: idx_fee_history_fee_type; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_fee_history_fee_type ON public.fee_history USING btree (fee_type);


--
-- Name: idx_fee_history_transaction_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_fee_history_transaction_id ON public.fee_history USING btree (transaction_id);


--
-- Name: idx_fee_history_type; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_fee_history_type ON public.fee_history USING btree (fee_type);


--
-- Name: idx_loan_installments_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loan_installments_created_at ON public.loan_installments USING btree (created_at);


--
-- Name: idx_loan_installments_loan_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loan_installments_loan_id ON public.loan_installments USING btree (loan_id);


--
-- Name: idx_loan_installments_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loan_installments_status ON public.loan_installments USING btree (status);


--
-- Name: idx_loans_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loans_created_at ON public.loans USING btree (created_at);


--
-- Name: idx_loans_due_date; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loans_due_date ON public.loans USING btree (due_date);


--
-- Name: idx_loans_pending_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loans_pending_status ON public.loans USING btree (status) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: idx_loans_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loans_status ON public.loans USING btree (status);


--
-- Name: idx_loans_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_loans_user_id ON public.loans USING btree (user_id);


--
-- Name: idx_notification_settings_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_notification_settings_user_id ON public.notification_settings USING btree (user_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_quotas_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_quotas_status ON public.quotas USING btree (status);


--
-- Name: idx_quotas_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_quotas_user_id ON public.quotas USING btree (user_id);


--
-- Name: idx_rate_limit_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_rate_limit_created_at ON public.rate_limit_logs USING btree (created_at);


--
-- Name: idx_rate_limit_identifier; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_rate_limit_identifier ON public.rate_limit_logs USING btree (identifier);


--
-- Name: idx_referrals_code; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_referrals_code ON public.referrals USING btree (referral_code);


--
-- Name: idx_referrals_referred_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_referrals_referred_id ON public.referrals USING btree (referred_id);


--
-- Name: idx_referrals_referrer_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_referrals_referrer_id ON public.referrals USING btree (referrer_id);


--
-- Name: idx_referrals_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_referrals_status ON public.referrals USING btree (status);


--
-- Name: idx_support_tickets_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_priority; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_support_tickets_priority ON public.support_tickets USING btree (priority);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_support_tickets_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets USING btree (user_id);


--
-- Name: idx_transactions_created_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at);


--
-- Name: idx_transactions_pending; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_transactions_pending ON public.transactions USING btree (status) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: idx_transactions_user_type_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_transactions_user_type_status ON public.transactions USING btree (user_id, type, status);


--
-- Name: idx_user_financial_summary_last_calculated; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_user_financial_summary_last_calculated ON public.user_financial_summary USING btree (last_calculated_at DESC);


--
-- Name: idx_user_financial_summary_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_user_financial_summary_user_id ON public.user_financial_summary USING btree (user_id);


--
-- Name: idx_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_user_statistics_last_activity; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_user_statistics_last_activity ON public.user_statistics USING btree (last_activity);


--
-- Name: idx_user_statistics_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_user_statistics_user_id ON public.user_statistics USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_is_admin; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_users_is_admin ON public.users USING btree (is_admin);


--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);


--
-- Name: idx_users_referred_by; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_users_referred_by ON public.users USING btree (referred_by);


--
-- Name: idx_withdrawals_status; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_withdrawals_status ON public.withdrawals USING btree (status);


--
-- Name: idx_withdrawals_user_id; Type: INDEX; Schema: public; Owner: cred30user
--

CREATE INDEX idx_withdrawals_user_id ON public.withdrawals USING btree (user_id);


--
-- Name: app_settings update_app_settings_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loan_installments update_loan_installments_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_loan_installments_updated_at BEFORE UPDATE ON public.loan_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loans update_loans_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_settings update_notification_settings_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: referrals update_referrals_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: support_tickets update_support_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_config update_system_config_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON public.system_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_fees update_system_fees_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_system_fees_updated_at BEFORE UPDATE ON public.system_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_settings update_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transactions update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_statistics update_user_statistics_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_user_statistics_updated_at BEFORE UPDATE ON public.user_statistics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: withdrawals update_withdrawals_updated_at; Type: TRIGGER; Schema: public; Owner: cred30user
--

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_logs admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: fee_history fee_history_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.fee_history
    ADD CONSTRAINT fee_history_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- Name: loan_installments loan_installments_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.loan_installments
    ADD CONSTRAINT loan_installments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: loans loans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notification_settings notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: quotas quotas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.quotas
    ADD CONSTRAINT quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_financial_summary user_financial_summary_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_financial_summary
    ADD CONSTRAINT user_financial_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_statistics user_statistics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.user_statistics
    ADD CONSTRAINT user_statistics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id);


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cred30user
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict s93bod2JFOe3TdmsZHAhowX193UabKEfxyBI2Td1fSKcaLR4KMZSprPp53sXZAW

