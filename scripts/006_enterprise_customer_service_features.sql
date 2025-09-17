-- Enterprise Customer Service Features
-- Extends the existing customer service system with surveys, agent metrics, quality scoring, and file attachments

-- =====================================
-- CUSTOMER SATISFACTION SURVEYS
-- =====================================

-- Survey templates
CREATE TABLE IF NOT EXISTS public.survey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT CHECK (trigger_event IN ('conversation_resolved', 'manual', 'scheduled', 'escalation')) DEFAULT 'conversation_resolved',
  delivery_channels TEXT[] DEFAULT ARRAY['email'], -- email, sms, in_chat, whatsapp
  questions JSONB NOT NULL DEFAULT '[]', -- Array of question objects
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Individual surveys sent to customers
CREATE TABLE IF NOT EXISTS public.customer_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.survey_templates(id) ON DELETE CASCADE,
  customer_identifier TEXT NOT NULL, -- email, phone, or session ID
  delivery_channel TEXT NOT NULL CHECK (delivery_channel IN ('email', 'sms', 'in_chat', 'whatsapp')),
  status TEXT CHECK (status IN ('pending', 'sent', 'completed', 'expired', 'failed')) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survey responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.customer_surveys(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- Reference to question in template
  response_value TEXT, -- For rating questions, this would be "1-5", for text it's the answer
  response_type TEXT CHECK (response_type IN ('rating', 'text', 'multiple_choice', 'yes_no')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- AGENT PERFORMANCE METRICS
-- =====================================

-- Agent profiles (extends auth.users for agents)
CREATE TABLE IF NOT EXISTS public.agent_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Business owner
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('agent', 'supervisor', 'manager')) DEFAULT 'agent',
  status TEXT CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  max_concurrent_chats INTEGER DEFAULT 5,
  skills TEXT[], -- Array of skills/tags
  performance_goals JSONB DEFAULT '{}', -- Goals for various metrics
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Agent performance metrics (daily aggregations)
CREATE TABLE IF NOT EXISTS public.agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Business owner
  metric_date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  resolved_conversations INTEGER DEFAULT 0,
  escalated_conversations INTEGER DEFAULT 0,
  abandoned_conversations INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER, -- Average response time in seconds
  avg_resolution_time_seconds INTEGER, -- Average time to resolve
  customer_satisfaction_score DECIMAL(5,2), -- Average satisfaction rating
  efficiency_score DECIMAL(5,2), -- Custom efficiency metric
  goals_achieved JSONB DEFAULT '{}', -- Which goals were met
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, metric_date)
);

-- Agent goals and targets
CREATE TABLE IF NOT EXISTS public.agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE, -- NULL for team-wide goals
  goal_type TEXT CHECK (goal_type IN ('conversations_per_day', 'resolution_rate', 'response_time', 'satisfaction_score', 'efficiency')) NOT NULL,
  target_value DECIMAL(10,2) NOT NULL,
  period TEXT CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly')) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- CONVERSATION QUALITY SCORING
-- =====================================

-- Quality scoring criteria/templates
CREATE TABLE IF NOT EXISTS public.quality_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '[]', -- Array of scoring criteria with weights
  max_score INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Quality reviews (manual reviews by supervisors)
CREATE TABLE IF NOT EXISTS public.quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES public.quality_criteria(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  criteria_scores JSONB DEFAULT '{}', -- Individual criteria scores
  feedback TEXT,
  review_type TEXT CHECK (review_type IN ('random', 'flagged', 'escalated', 'training')) DEFAULT 'random',
  is_calibrated BOOLEAN DEFAULT false, -- For calibration exercises
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automated quality scores (AI-generated)
CREATE TABLE IF NOT EXISTS public.automated_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES public.quality_criteria(id) ON DELETE SET NULL,
  overall_score DECIMAL(5,2) NOT NULL,
  criteria_scores JSONB DEFAULT '{}',
  confidence_score DECIMAL(3,2), -- AI confidence in the scoring
  reasoning TEXT, -- AI explanation for the score
  flagged_for_review BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality improvement recommendations
CREATE TABLE IF NOT EXISTS public.quality_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  recommendation_type TEXT CHECK (recommendation_type IN ('response_time', 'tone', 'accuracy', 'empathy', 'compliance', 'process')) NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  description TEXT NOT NULL,
  suggested_action TEXT,
  status TEXT CHECK (status IN ('pending', 'acknowledged', 'implemented', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- FILE ATTACHMENTS
-- =====================================

-- File attachments table
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- in bytes
  file_type TEXT NOT NULL, -- MIME type
  file_path TEXT NOT NULL, -- Path in storage (Supabase Storage)
  file_url TEXT NOT NULL, -- Public URL for access
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_secure BOOLEAN DEFAULT false, -- Whether file requires authentication to access
  expires_at TIMESTAMP WITH TIME ZONE, -- For temporary files
  metadata JSONB DEFAULT '{}', -- Additional file metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File access logs (for security auditing)
CREATE TABLE IF NOT EXISTS public.file_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.file_attachments(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_type TEXT CHECK (access_type IN ('view', 'download', 'preview', 'share')) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- ENTERPRISE ANALYTICS & REPORTING
-- =====================================

-- Custom dashboards and reports
CREATE TABLE IF NOT EXISTS public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT CHECK (report_type IN ('agent_performance', 'customer_satisfaction', 'quality_scores', 'conversation_analytics', 'file_usage')) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}', -- Report configuration
  schedule JSONB DEFAULT '{}', -- Automated scheduling
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Report executions and cached results
CREATE TABLE IF NOT EXISTS public.report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.custom_reports(id) ON DELETE CASCADE,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'failed', 'running')) DEFAULT 'running',
  result_data JSONB, -- Cached report data
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Survey indexes
CREATE INDEX IF NOT EXISTS idx_survey_templates_user_id ON public.survey_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_surveys_conversation_id ON public.customer_surveys(conversation_id);
CREATE INDEX IF NOT EXISTS idx_customer_surveys_status ON public.customer_surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON public.survey_responses(survey_id);

-- Agent performance indexes
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user_id ON public.agent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_metrics_agent_date ON public.agent_performance_metrics(agent_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_performance_metrics_user_date ON public.agent_performance_metrics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_goals_user_id ON public.agent_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_goals_agent_id ON public.agent_goals(agent_id);

-- Quality scoring indexes
CREATE INDEX IF NOT EXISTS idx_quality_reviews_conversation_id ON public.quality_reviews(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_reviewer_id ON public.quality_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_automated_quality_scores_conversation_id ON public.automated_quality_scores(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quality_recommendations_agent_id ON public.quality_recommendations(agent_id);
CREATE INDEX IF NOT EXISTS idx_quality_recommendations_status ON public.quality_recommendations(status);

-- File attachment indexes
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation_id ON public.file_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_message_id ON public.file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_user_id ON public.file_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_file_id ON public.file_access_logs(file_id);

-- Report indexes
CREATE INDEX IF NOT EXISTS idx_custom_reports_user_id ON public.custom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON public.report_executions(report_id);

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- Enable RLS on all new tables
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for surveys
CREATE POLICY "survey_templates_own" ON public.survey_templates USING (auth.uid() = user_id);
CREATE POLICY "customer_surveys_own" ON public.customer_surveys USING (auth.uid() = user_id);
CREATE POLICY "survey_responses_own" ON public.survey_responses USING (auth.uid() = (SELECT user_id FROM public.customer_surveys WHERE id = survey_id));

-- RLS policies for agents
CREATE POLICY "agent_profiles_own" ON public.agent_profiles USING (auth.uid() = user_id);
CREATE POLICY "agent_performance_metrics_own" ON public.agent_performance_metrics USING (auth.uid() = user_id);
CREATE POLICY "agent_goals_own" ON public.agent_goals USING (auth.uid() = user_id);

-- RLS policies for quality scoring
CREATE POLICY "quality_criteria_own" ON public.quality_criteria USING (auth.uid() = user_id);
CREATE POLICY "quality_reviews_own" ON public.quality_reviews USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "automated_quality_scores_own" ON public.automated_quality_scores USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "quality_recommendations_own" ON public.quality_recommendations USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));

-- RLS policies for files
CREATE POLICY "file_attachments_own" ON public.file_attachments USING (auth.uid() = user_id);
CREATE POLICY "file_access_logs_own" ON public.file_access_logs USING (auth.uid() = (SELECT user_id FROM public.file_attachments WHERE id = file_id));

-- RLS policies for reports
CREATE POLICY "custom_reports_own" ON public.custom_reports USING (auth.uid() = user_id);
CREATE POLICY "report_executions_own" ON public.report_executions USING (auth.uid() = (SELECT user_id FROM public.custom_reports WHERE id = report_id));

-- =====================================
-- FUNCTIONS AND TRIGGERS
-- =====================================

-- Function to automatically create survey when conversation is resolved
CREATE OR REPLACE FUNCTION create_customer_survey()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create survey for resolved conversations if templates exist
  IF NEW.status IN ('resolved', 'escalated') AND (OLD.status IS NULL OR OLD.status NOT IN ('resolved', 'escalated')) THEN
    -- Insert surveys for active templates that trigger on resolution
    INSERT INTO public.customer_surveys (
      user_id,
      conversation_id,
      template_id,
      customer_identifier,
      delivery_channel,
      expires_at
    )
    SELECT
      st.user_id,
      NEW.id,
      st.id,
      NEW.customer_identifier,
      unnest(st.delivery_channels),
      NOW() + INTERVAL '7 days'
    FROM public.survey_templates st
    WHERE st.user_id = NEW.user_id
      AND st.trigger_event = 'conversation_resolved'
      AND st.is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to create surveys on conversation resolution
DROP TRIGGER IF EXISTS trigger_create_customer_survey ON public.chat_conversations;
CREATE TRIGGER trigger_create_customer_survey
  AFTER UPDATE OF status ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION create_customer_survey();

-- Function to update agent performance metrics
CREATE OR REPLACE FUNCTION update_agent_performance_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update metrics when conversation status changes
  IF NEW.status != OLD.status THEN
    -- This would be called to aggregate metrics, but for now just log the change
    -- In production, this would trigger metric calculations
    INSERT INTO public.agent_performance_metrics (
      agent_id,
      user_id,
      metric_date,
      total_conversations
    )
    VALUES (
      COALESCE(NEW.assigned_agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
      NEW.user_id,
      CURRENT_DATE,
      1
    )
    ON CONFLICT (agent_id, metric_date)
    DO UPDATE SET
      total_conversations = agent_performance_metrics.total_conversations + 1,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to update agent metrics
DROP TRIGGER IF EXISTS trigger_update_agent_metrics ON public.chat_conversations;
CREATE TRIGGER trigger_update_agent_metrics
  AFTER UPDATE OF status ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_performance_metrics();

-- =====================================
-- SEED DATA
-- =====================================

-- Insert default survey template
INSERT INTO public.survey_templates (
  user_id,
  name,
  description,
  trigger_event,
  delivery_channels,
  questions
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Post-Conversation Satisfaction Survey',
  'Default survey sent after conversation resolution',
  'conversation_resolved',
  ARRAY['email', 'sms'],
  '[
    {
      "id": "satisfaction_rating",
      "type": "rating",
      "question": "How satisfied are you with the service you received?",
      "scale": 5,
      "required": true
    },
    {
      "id": "resolution_quality",
      "type": "rating",
      "question": "How well did we resolve your issue?",
      "scale": 5,
      "required": true
    },
    {
      "id": "response_time",
      "type": "rating",
      "question": "How would you rate our response time?",
      "scale": 5,
      "required": true
    },
    {
      "id": "comments",
      "type": "text",
      "question": "Any additional comments or suggestions?",
      "required": false
    }
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- Insert default quality criteria
INSERT INTO public.quality_criteria (
  user_id,
  name,
  description,
  criteria,
  max_score
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Standard Quality Criteria',
  'Default quality assessment criteria',
  '[
    {
      "name": "Greeting",
      "description": "Proper greeting and introduction",
      "weight": 10,
      "max_score": 10
    },
    {
      "name": "Understanding",
      "description": "Correct understanding of customer issue",
      "weight": 20,
      "max_score": 20
    },
    {
      "name": "Communication",
      "description": "Clear and professional communication",
      "weight": 25,
      "max_score": 25
    },
    {
      "name": "Resolution",
      "description": "Effective problem resolution",
      "weight": 30,
      "max_score": 30
    },
    {
      "name": "Closing",
      "description": "Proper conversation closure",
      "weight": 15,
      "max_score": 15
    }
  ]'::jsonb,
  100
) ON CONFLICT DO NOTHING;