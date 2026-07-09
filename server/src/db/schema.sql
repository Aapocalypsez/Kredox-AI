CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE campaign_channel AS ENUM ('sms', 'whatsapp', 'email');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_link_status AS ENUM ('pending', 'opened', 'expired', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE video_session_status AS ENUM ('active', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  declared_age INTEGER,
  declared_monthly_income NUMERIC,
  employment_type TEXT,
  loan_purpose TEXT,
  city TEXT,
  declared_state TEXT,
  pincode TEXT,
  bureau_score INTEGER,
  existing_loans INTEGER,
  loan_amount_requested NUMERIC,
  lender_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS declared_age INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS declared_monthly_income NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loan_purpose TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS declared_state TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bureau_score INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS existing_loans INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loan_amount_requested NUMERIC;

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel campaign_channel NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status campaign_link_status NOT NULL DEFAULT 'pending',
  dispatch_status TEXT NOT NULL DEFAULT 'pending',
  dispatch_reason TEXT,
  provider_status TEXT,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE campaign_links ADD COLUMN IF NOT EXISTS dispatch_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE campaign_links ADD COLUMN IF NOT EXISTS dispatch_reason TEXT;
ALTER TABLE campaign_links ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE campaign_links ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_campaign_links_campaign_id ON campaign_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_links_token ON campaign_links(token);
CREATE INDEX IF NOT EXISTS idx_campaign_links_status ON campaign_links(status);
CREATE INDEX IF NOT EXISTS idx_customers_lender_id ON customers(lender_id);

CREATE TABLE IF NOT EXISTS video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  agent_id TEXT,
  channel_name TEXT NOT NULL,
  status video_session_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  geo_match BOOLEAN,
  call_city TEXT,
  call_state TEXT,
  recording_url TEXT,
  recording_storage_key TEXT,
  recording_url_expires_at TIMESTAMPTZ
);

ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS geo_match BOOLEAN;
ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS call_city TEXT;
ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS call_state TEXT;
ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS recording_storage_key TEXT;
ALTER TABLE video_sessions ALTER COLUMN agent_id DROP NOT NULL;
ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS recording_url_expires_at TIMESTAMPTZ;
ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS device_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;

CREATE INDEX IF NOT EXISTS idx_video_sessions_customer_id ON video_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_agent_id ON video_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_channel_name ON video_sessions(channel_name);

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  speaker TEXT,
  text TEXT NOT NULL,
  offset_seconds NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC
);

ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS offset_seconds NUMERIC;

CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON transcripts(timestamp);

CREATE TABLE IF NOT EXISTS cv_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  age_low INTEGER,
  age_high INTEGER,
  liveness_score INTEGER NOT NULL,
  liveness_status TEXT NOT NULL CHECK (liveness_status IN ('PASS', 'FAIL')),
  age_flag BOOLEAN NOT NULL DEFAULT FALSE,
  raw_response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_analysis_session_id ON cv_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_cv_analysis_created_at ON cv_analysis(created_at);

CREATE TABLE IF NOT EXISTS llm_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES video_sessions(id) ON DELETE CASCADE,
  risk_band TEXT NOT NULL CHECK (risk_band IN ('A', 'B', 'C', 'D')),
  persona TEXT NOT NULL,
  red_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  confidence_score INTEGER NOT NULL,
  recommended_action TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_analysis_session_id ON llm_analysis(session_id);

CREATE TABLE IF NOT EXISTS geo_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  gps_city TEXT,
  gps_state TEXT,
  gps_country TEXT,
  gps_pincode TEXT,
  ip_city TEXT,
  ip_region TEXT,
  ip_country TEXT,
  ip_isp TEXT,
  declared_city TEXT,
  declared_state TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  geo_score INTEGER NOT NULL,
  flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  match_status TEXT NOT NULL CHECK (match_status IN ('MATCH', 'PARTIAL', 'MISMATCH')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_verifications_session_id ON geo_verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_geo_verifications_created_at ON geo_verifications(created_at);

CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  final_score NUMERIC NOT NULL,
  risk_band TEXT NOT NULL CHECK (risk_band IN ('A', 'B', 'C', 'D')),
  policy_score NUMERIC NOT NULL,
  ml_risk_score NUMERIC NOT NULL,
  llm_confidence_score NUMERIC NOT NULL,
  policy_result JSONB NOT NULL,
  ml_result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_session_id ON risk_assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_customer_id ON risk_assessments(customer_id);

CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  application_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  fields_needing_review TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_applications_session_id ON loan_applications(session_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_customer_id ON loan_applications(customer_id);

CREATE TABLE IF NOT EXISTS application_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_edits_application_id ON application_edits(application_id);

CREATE TABLE IF NOT EXISTS loan_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  band TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  tenure_months INTEGER NOT NULL,
  emi NUMERIC NOT NULL,
  processing_fee NUMERIC NOT NULL,
  explanation_text TEXT NOT NULL,
  emi_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE loan_offers ADD COLUMN IF NOT EXISTS public_token TEXT;
UPDATE loan_offers
SET public_token = encode(gen_random_bytes(24), 'hex')
WHERE public_token IS NULL;
ALTER TABLE loan_offers ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(24), 'hex');
ALTER TABLE loan_offers ALTER COLUMN public_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_offers_application_id ON loan_offers(application_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_offers_public_token ON loan_offers(public_token);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (actor_type IN ('agent', 'system', 'customer')),
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);

CREATE TABLE IF NOT EXISTS agent_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_refresh_tokens_agent_id ON agent_refresh_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_refresh_tokens_token_hash ON agent_refresh_tokens(token_hash);
