-- Extended database schema for PrismAI
-- This builds upon the existing schema in 001_create_database_schema.sql

-- =====================================
-- SUBSCRIPTION & BILLING MANAGEMENT
-- =====================================

-- Subscription plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  features JSONB NOT NULL DEFAULT '[]',
  limits JSONB NOT NULL DEFAULT '{}', -- e.g., {"contacts": 1000, "emails_per_month": 5000}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'paused')) DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- One subscription per user
);

-- =====================================
-- LEAD GENERATION SYSTEM
-- =====================================

-- Lead sources configuration
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('website', 'social_media', 'email', 'manual', 'api', 'facebook', 'google_ads', 'linkedin')) NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads database
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.lead_sources(id),
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  status TEXT CHECK (status IN ('new', 'contacted', 'qualified', 'opportunity', 'customer', 'lost')) DEFAULT 'new',
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead interactions/activities
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('email_sent', 'email_opened', 'email_clicked', 'call_made', 'meeting_scheduled', 'form_submitted', 'website_visit', 'social_interaction')) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- CHATBOT & CUSTOMER SERVICE
-- =====================================

-- Knowledge base for chatbots
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,
  search_vector tsvector, -- For full-text search
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id),
  channel TEXT CHECK (channel IN ('website', 'whatsapp', 'sms', 'messenger', 'slack')) NOT NULL,
  customer_identifier TEXT NOT NULL, -- phone, email, or session ID
  status TEXT CHECK (status IN ('active', 'resolved', 'escalated', 'abandoned')) DEFAULT 'active',
  assigned_agent_id UUID REFERENCES auth.users(id),
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_type TEXT CHECK (sender_type IN ('customer', 'ai', 'agent')) NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'file', 'quick_reply', 'template')) DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- MARKETING AUTOMATION
-- =====================================

-- Email campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  campaign_type TEXT CHECK (campaign_type IN ('newsletter', 'promotional', 'nurture', 'welcome', 'abandoned_cart')) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')) DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  target_audience JSONB DEFAULT '{}', -- Criteria for targeting
  statistics JSONB DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social media posts
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok')) NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[],
  status TEXT CHECK (status IN ('draft', 'scheduled', 'published', 'failed')) DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  external_post_id TEXT,
  engagement_stats JSONB DEFAULT '{"likes": 0, "shares": 0, "comments": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketing automation workflows
CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('lead_created', 'email_opened', 'form_submitted', 'date_based', 'behavior')) NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  workflow_steps JSONB NOT NULL DEFAULT '[]', -- Array of steps with actions
  is_active BOOLEAN DEFAULT true,
  statistics JSONB DEFAULT '{"triggered": 0, "completed": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- ANALYTICS & INSIGHTS
-- =====================================

-- Analytics events (for tracking user behavior)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id),
  event_name TEXT NOT NULL,
  event_properties JSONB DEFAULT '{}',
  session_id TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business metrics aggregations
CREATE TABLE IF NOT EXISTS public.business_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  metric_date DATE NOT NULL,
  dimensions JSONB DEFAULT '{}', -- For filtering/grouping
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_name, metric_date, dimensions)
);

-- =====================================
-- INTEGRATIONS & EXTERNAL SERVICES
-- =====================================

-- Integration configurations
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_type TEXT CHECK (service_type IN ('crm', 'email', 'social', 'analytics', 'payment', 'calendar')) NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}', -- Encrypted
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- Lead activities indexes
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON public.lead_activities(type);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON public.lead_activities(created_at DESC);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON public.chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Marketing indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON public.social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON public.social_posts(scheduled_at);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_metrics_user_id ON public.business_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_business_metrics_date ON public.business_metrics(metric_date DESC);

-- Full-text search index for knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON public.knowledge_base USING gin(search_vector);

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- Enable RLS on all new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription plans (public read)
CREATE POLICY "plans_public_read" ON public.subscription_plans FOR SELECT USING (true);

-- RLS policies for user-specific data
CREATE POLICY "user_subscriptions_own" ON public.user_subscriptions USING (auth.uid() = user_id);
CREATE POLICY "lead_sources_own" ON public.lead_sources USING (auth.uid() = user_id);
CREATE POLICY "leads_own" ON public.leads USING (auth.uid() = user_id);
CREATE POLICY "lead_activities_own" ON public.lead_activities USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "knowledge_base_own" ON public.knowledge_base USING (auth.uid() = user_id);
CREATE POLICY "chat_conversations_own" ON public.chat_conversations USING (auth.uid() = user_id);
CREATE POLICY "chat_messages_own" ON public.chat_messages USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "email_campaigns_own" ON public.email_campaigns USING (auth.uid() = user_id);
CREATE POLICY "social_posts_own" ON public.social_posts USING (auth.uid() = user_id);
CREATE POLICY "automation_workflows_own" ON public.automation_workflows USING (auth.uid() = user_id);
CREATE POLICY "analytics_events_own" ON public.analytics_events USING (auth.uid() = user_id);
CREATE POLICY "business_metrics_own" ON public.business_metrics USING (auth.uid() = user_id);
CREATE POLICY "integrations_own" ON public.integrations USING (auth.uid() = user_id);

-- =====================================
-- SEED DATA
-- =====================================

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, features, limits) VALUES
('Essential', 'Perfect for small businesses getting started with AI automation', 99.00, 990.00, 
 '["PrismAI Assistant", "Basic Chatbot", "Lead Capture Forms", "Email Automation"]',
 '{"contacts": 1000, "emails_per_month": 5000, "chatbot_messages": 2000}'),
('Growth', 'Advanced AI tools for growing businesses', 299.00, 2990.00,
 '["Everything in Essential", "Advanced Lead Generation", "Social Media Automation", "Analytics Dashboard", "CRM Integration"]',
 '{"contacts": 10000, "emails_per_month": 25000, "chatbot_messages": 10000, "social_posts": 200}'),
('Enterprise', 'Full AI suite for scaling businesses', 799.00, 7990.00,
 '["Everything in Growth", "Custom AI Training", "Advanced Analytics", "Priority Support", "White-label Options"]',
 '{"contacts": -1, "emails_per_month": -1, "chatbot_messages": -1, "social_posts": -1}')
ON CONFLICT DO NOTHING;