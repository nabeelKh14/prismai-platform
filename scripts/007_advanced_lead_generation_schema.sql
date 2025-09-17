-- Advanced Lead Generation Schema Extensions
-- Adds support for nurturing workflows, A/B testing, predictive scoring, and analytics

-- Nurturing Workflows
CREATE TABLE IF NOT EXISTS public.lead_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
  trigger_type TEXT CHECK (trigger_type IN ('lead_created', 'score_changed', 'behavior', 'time_based', 'manual')) NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  workflow_steps JSONB NOT NULL DEFAULT '[]', -- Array of workflow steps with conditions and actions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.lead_workflows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'paused')) DEFAULT 'running',
  current_step INTEGER DEFAULT 0,
  execution_data JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  next_execution_at TIMESTAMP WITH TIME ZONE
);

-- A/B Testing Framework
CREATE TABLE IF NOT EXISTS public.ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  test_type TEXT CHECK (test_type IN ('email_subject', 'email_content', 'send_time', 'landing_page', 'cta_button')) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'running', 'completed', 'paused')) DEFAULT 'draft',
  target_audience JSONB NOT NULL DEFAULT '{}', -- Segmentation criteria
  variants JSONB NOT NULL DEFAULT '[]', -- Array of test variants
  winner_criteria JSONB NOT NULL DEFAULT '{}', -- How to determine winner
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B Test Results
CREATE TABLE IF NOT EXISTS public.ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence_level NUMERIC,
  is_significant BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Segmentation
CREATE TABLE IF NOT EXISTS public.lead_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  segment_type TEXT CHECK (segment_type IN ('static', 'dynamic')) DEFAULT 'dynamic',
  criteria JSONB NOT NULL DEFAULT '{}', -- Segmentation rules
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segment Membership (for dynamic segments)
CREATE TABLE IF NOT EXISTS public.lead_segment_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(segment_id, lead_id)
);

-- Predictive Scoring Models
CREATE TABLE IF NOT EXISTS public.predictive_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_type TEXT CHECK (model_type IN ('conversion_probability', 'lifetime_value', 'engagement_score')) NOT NULL,
  algorithm TEXT CHECK (algorithm IN ('linear_regression', 'random_forest', 'neural_network', 'gradient_boosting')) NOT NULL,
  features JSONB NOT NULL DEFAULT '[]', -- Features used in the model
  parameters JSONB NOT NULL DEFAULT '{}', -- Model parameters
  performance_metrics JSONB NOT NULL DEFAULT '{}', -- Accuracy, precision, recall, etc.
  training_data JSONB NOT NULL DEFAULT '{}', -- Training data summary
  is_active BOOLEAN DEFAULT FALSE,
  last_trained_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Engagement Tracking
CREATE TABLE IF NOT EXISTS public.lead_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('email', 'website', 'social', 'ads', 'direct', 'referral')) NOT NULL,
  engagement_type TEXT CHECK (engagement_type IN ('view', 'click', 'download', 'share', 'comment', 'like', 'follow', 'unsubscribe')) NOT NULL,
  content_id TEXT, -- ID of the content engaged with
  metadata JSONB NOT NULL DEFAULT '{}', -- Additional engagement data
  engagement_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Conversion Funnel
CREATE TABLE IF NOT EXISTS public.lead_funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL,
  conversion_criteria JSONB NOT NULL DEFAULT '{}', -- How to determine if lead moved to this stage
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, stage_order)
);

-- Funnel Stage Transitions
CREATE TABLE IF NOT EXISTS public.funnel_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.lead_funnel_stages(id),
  to_stage_id UUID NOT NULL REFERENCES public.lead_funnel_stages(id),
  transition_reason TEXT,
  transitioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attribution Tracking
CREATE TABLE IF NOT EXISTS public.attribution_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.lead_sources(id),
  touchpoint_type TEXT CHECK (touchpoint_type IN ('first_touch', 'last_touch', 'lead_creation', 'engagement', 'conversion')) NOT NULL,
  channel TEXT NOT NULL,
  campaign_id TEXT,
  referrer_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  attribution_weight NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Management
CREATE TABLE IF NOT EXISTS public.lead_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT CHECK (campaign_type IN ('nurturing', 'outreach', 'retargeting', 'welcome', 'educational')) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed')) DEFAULT 'draft',
  target_segment_id UUID REFERENCES public.lead_segments(id),
  workflow_id UUID REFERENCES public.lead_workflows(id),
  ab_test_id UUID REFERENCES public.ab_tests(id),
  budget NUMERIC,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  performance_metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Sequences
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('lead_created', 'behavior', 'time_based', 'manual', 'score_threshold')) NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  sequence_steps JSONB NOT NULL DEFAULT '[]', -- Array of email steps with delays and conditions
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sequence Enrollments
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active', 'completed', 'paused', 'cancelled')) DEFAULT 'active',
  current_step INTEGER DEFAULT 0,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  next_step_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(sequence_id, lead_id)
);

-- Extend existing leads table with new fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS predictive_score NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT CHECK (lifecycle_stage IN ('awareness', 'interest', 'consideration', 'intent', 'evaluation', 'purchase', 'retention', 'advocacy'));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversion_probability NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_value NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_workflows_user_id ON public.lead_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_lead_id ON public.workflow_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_user_id ON public.ab_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON public.ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_lead_segments_user_id ON public.lead_segments(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_segment_membership_segment_id ON public.lead_segment_membership(segment_id);
CREATE INDEX IF NOT EXISTS idx_lead_segment_membership_lead_id ON public.lead_segment_membership(lead_id);
CREATE INDEX IF NOT EXISTS idx_predictive_models_user_id ON public.predictive_models(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_engagement_lead_id ON public.lead_engagement(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_engagement_created_at ON public.lead_engagement(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_funnel_stages_user_id ON public.lead_funnel_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_funnel_transitions_lead_id ON public.funnel_transitions(lead_id);
CREATE INDEX IF NOT EXISTS idx_attribution_touchpoints_lead_id ON public.attribution_touchpoints(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaigns_user_id ON public.lead_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_user_id ON public.email_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_lead_id ON public.sequence_enrollments(lead_id);

-- Row Level Security
ALTER TABLE public.lead_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_segment_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "lead_workflows_own" ON public.lead_workflows USING (auth.uid() = user_id);
CREATE POLICY "workflow_executions_own" ON public.workflow_executions USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "ab_tests_own" ON public.ab_tests USING (auth.uid() = user_id);
CREATE POLICY "ab_test_results_own" ON public.ab_test_results USING (auth.uid() = (SELECT user_id FROM public.ab_tests WHERE id = test_id));
CREATE POLICY "lead_segments_own" ON public.lead_segments USING (auth.uid() = user_id);
CREATE POLICY "lead_segment_membership_own" ON public.lead_segment_membership USING (auth.uid() = (SELECT user_id FROM public.lead_segments WHERE id = segment_id));
CREATE POLICY "predictive_models_own" ON public.predictive_models USING (auth.uid() = user_id);
CREATE POLICY "lead_engagement_own" ON public.lead_engagement USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "lead_funnel_stages_own" ON public.lead_funnel_stages USING (auth.uid() = user_id);
CREATE POLICY "funnel_transitions_own" ON public.funnel_transitions USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "attribution_touchpoints_own" ON public.attribution_touchpoints USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "lead_campaigns_own" ON public.lead_campaigns USING (auth.uid() = user_id);
CREATE POLICY "email_sequences_own" ON public.email_sequences USING (auth.uid() = user_id);
CREATE POLICY "sequence_enrollments_own" ON public.sequence_enrollments USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));