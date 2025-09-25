-- Personalization Engine Schema
-- Database schema for dynamic personalization engine with behavioral triggers and nurturing sequences

-- =====================================
-- LEAD PROFILES AND PREFERENCES
-- =====================================

-- Lead behavior patterns
CREATE TABLE IF NOT EXISTS public.lead_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  behavior_type TEXT NOT NULL, -- engagement, content_interaction, timing, channel_preference
  behavior_data JSONB NOT NULL DEFAULT '{}',
  pattern_analysis JSONB NOT NULL DEFAULT '{}', -- AI analysis of the pattern
  confidence_score DECIMAL(3,2) NOT NULL, -- 0-1 confidence in pattern
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead preferences (inferred from behavior)
CREATE TABLE IF NOT EXISTS public.lead_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content_types TEXT[] DEFAULT ARRAY['educational'], -- educational, promotional, case_study, etc.
  communication_channels TEXT[] DEFAULT ARRAY['email'], -- email, sms, whatsapp, chat, phone
  preferred_times JSONB DEFAULT '[]', -- Array of preferred time slots
  topics TEXT[] DEFAULT ARRAY[], -- Topics of interest
  tone TEXT CHECK (tone IN ('formal', 'casual', 'professional')) DEFAULT 'professional',
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')) DEFAULT 'weekly',
  inferred_from JSONB DEFAULT '{}', -- What behavior led to these preferences
  confidence_score DECIMAL(3,2) DEFAULT 0.5, -- Confidence in inferred preferences
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id)
);

-- Lead journey stages
CREATE TABLE IF NOT EXISTS public.lead_journey_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  current_stage TEXT CHECK (current_stage IN ('awareness', 'consideration', 'decision', 'retention', 'advocacy')) NOT NULL DEFAULT 'awareness',
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  next_actions TEXT[] DEFAULT ARRAY[],
  blockers TEXT[] DEFAULT ARRAY[],
  stage_data JSONB DEFAULT '{}', -- Additional stage-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id)
);

-- =====================================
-- BEHAVIORAL TRIGGERS
-- =====================================

-- Behavioral trigger definitions
CREATE TABLE IF NOT EXISTS public.behavioral_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('behavior', 'score_change', 'engagement', 'time_based', 'custom')) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}', -- Trigger conditions
  actions JSONB NOT NULL DEFAULT '[]', -- Actions to execute
  priority INTEGER DEFAULT 1,
  cooldown_minutes INTEGER DEFAULT 0, -- Minimum time between triggers
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Trigger execution logs
CREATE TABLE IF NOT EXISTS public.trigger_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES public.behavioral_triggers(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  conditions_met JSONB DEFAULT '{}', -- Which conditions were met
  actions_executed JSONB DEFAULT '[]', -- Which actions were executed
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- NURTURING SEQUENCES
-- =====================================

-- Nurturing sequence templates
CREATE TABLE IF NOT EXISTS public.nurturing_sequence_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('welcome', 'educational', 'promotional', 'reengagement', 'custom')) DEFAULT 'custom',
  stages JSONB NOT NULL DEFAULT '[]', -- Sequence stage definitions
  target_audience JSONB DEFAULT '{}', -- Criteria for when to use this template
  performance_metrics JSONB DEFAULT '{}', -- Historical performance data
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Active nurturing sequences
CREATE TABLE IF NOT EXISTS public.nurturing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.nurturing_sequence_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  stages JSONB NOT NULL DEFAULT '[]', -- Current stage definitions (may be adapted)
  current_stage INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'paused', 'completed', 'archived')) DEFAULT 'active',
  performance JSONB DEFAULT '{
    "totalSent": 0,
    "totalOpened": 0,
    "totalClicked": 0,
    "totalReplied": 0,
    "totalConverted": 0,
    "avgEngagementTime": 0,
    "bounceRate": 0,
    "unsubscribeRate": 0
  }',
  personalization_data JSONB DEFAULT '{}', -- Lead-specific personalization data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id, name)
);

-- Sequence stage executions
CREATE TABLE IF NOT EXISTS public.sequence_stage_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.nurturing_sequences(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  stage_name TEXT NOT NULL,
  stage_type TEXT CHECK (stage_type IN ('content', 'action', 'wait', 'decision')) NOT NULL,
  content JSONB, -- Content sent in this stage
  execution_status TEXT CHECK (execution_status IN ('pending', 'executed', 'failed', 'skipped')) DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  execution_time_ms INTEGER,
  result_data JSONB DEFAULT '{}', -- Results of stage execution
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- CONTENT ADAPTATION
-- =====================================

-- Content adaptation strategies
CREATE TABLE IF NOT EXISTS public.content_adaptation_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  strategy_type TEXT CHECK (strategy_type IN ('tone', 'complexity', 'length', 'format', 'frequency')) NOT NULL,
  original_value TEXT,
  adapted_value TEXT,
  adaptation_reason TEXT,
  confidence_score DECIMAL(3,2),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content performance tracking
CREATE TABLE IF NOT EXISTS public.content_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content_type TEXT CHECK (content_type IN ('email', 'sms', 'whatsapp', 'chat')) NOT NULL,
  content_id TEXT, -- Reference to specific content piece
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  engagement_score DECIMAL(5,2),
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- PERSONALIZATION ANALYTICS
-- =====================================

-- Personalization performance metrics
CREATE TABLE IF NOT EXISTS public.personalization_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  total_leads INTEGER DEFAULT 0,
  personalized_sequences INTEGER DEFAULT 0,
  behavioral_triggers INTEGER DEFAULT 0,
  content_adaptations INTEGER DEFAULT 0,
  avg_engagement_lift DECIMAL(5,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  personalization_roi DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_date)
);

-- A/B test results for personalization
CREATE TABLE IF NOT EXISTS public.personalization_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_description TEXT,
  control_group TEXT NOT NULL, -- 'standard' or 'no_personalization'
  variant_group TEXT NOT NULL, -- 'personalized' or 'adaptive'
  target_audience JSONB DEFAULT '{}',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('draft', 'running', 'completed', 'archived')) DEFAULT 'draft',
  results JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Lead behavior indexes
CREATE INDEX IF NOT EXISTS idx_lead_behavior_patterns_lead_id ON public.lead_behavior_patterns(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_behavior_patterns_type ON public.lead_behavior_patterns(behavior_type);
CREATE INDEX IF NOT EXISTS idx_lead_behavior_patterns_created_at ON public.lead_behavior_patterns(created_at DESC);

-- Lead preferences indexes
CREATE INDEX IF NOT EXISTS idx_lead_preferences_lead_id ON public.lead_preferences(lead_id);

-- Journey stage indexes
CREATE INDEX IF NOT EXISTS idx_lead_journey_stages_lead_id ON public.lead_journey_stages(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_journey_stages_stage ON public.lead_journey_stages(current_stage);

-- Trigger indexes
CREATE INDEX IF NOT EXISTS idx_behavioral_triggers_user_id ON public.behavioral_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_triggers_active ON public.behavioral_triggers(is_active);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_trigger_id ON public.trigger_executions(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_lead_id ON public.trigger_executions(lead_id);

-- Sequence indexes
CREATE INDEX IF NOT EXISTS idx_nurturing_sequence_templates_user_id ON public.nurturing_sequence_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_nurturing_sequences_lead_id ON public.nurturing_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_nurturing_sequences_status ON public.nurturing_sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequence_stage_executions_sequence_id ON public.sequence_stage_executions(sequence_id);

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_adaptation_strategies_lead_id ON public.content_adaptation_strategies(lead_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_lead_id ON public.content_performance(lead_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_type ON public.content_performance(content_type);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_personalization_metrics_user_date ON public.personalization_metrics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_personalization_ab_tests_user_id ON public.personalization_ab_tests(user_id);

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- Enable RLS on all tables
ALTER TABLE public.lead_behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nurturing_sequence_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nurturing_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_stage_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_adaptation_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalization_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalization_ab_tests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "lead_behavior_patterns_own" ON public.lead_behavior_patterns USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "lead_preferences_own" ON public.lead_preferences USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "lead_journey_stages_own" ON public.lead_journey_stages USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "behavioral_triggers_own" ON public.behavioral_triggers USING (auth.uid() = user_id);
CREATE POLICY "trigger_executions_own" ON public.trigger_executions USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "nurturing_sequence_templates_own" ON public.nurturing_sequence_templates USING (auth.uid() = user_id);
CREATE POLICY "nurturing_sequences_own" ON public.nurturing_sequences USING (auth.uid() = user_id);
CREATE POLICY "sequence_stage_executions_own" ON public.sequence_stage_executions USING (auth.uid() = (SELECT user_id FROM public.nurturing_sequences WHERE id = sequence_id));
CREATE POLICY "content_adaptation_strategies_own" ON public.content_adaptation_strategies USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "content_performance_own" ON public.content_performance USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "personalization_metrics_own" ON public.personalization_metrics USING (auth.uid() = user_id);
CREATE POLICY "personalization_ab_tests_own" ON public.personalization_ab_tests USING (auth.uid() = user_id);

-- =====================================
-- FUNCTIONS AND TRIGGERS
-- =====================================

-- Function to update lead preferences based on behavior
CREATE OR REPLACE FUNCTION update_lead_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update preferences when new behavior pattern is recorded
  -- This would trigger AI analysis to update preferences
  -- For now, just update the timestamp
  UPDATE public.lead_preferences
  SET updated_at = NOW()
  WHERE lead_id = NEW.lead_id;

  RETURN NEW;
END;
$$;

-- Trigger to update preferences on behavior pattern insert
DROP TRIGGER IF EXISTS trigger_update_lead_preferences ON public.lead_behavior_patterns;
CREATE TRIGGER trigger_update_lead_preferences
  AFTER INSERT ON public.lead_behavior_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_preferences();

-- Function to update journey stage based on lead activities
CREATE OR REPLACE FUNCTION update_journey_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update journey stage when lead score or status changes
  IF NEW.lead_score != OLD.lead_score OR NEW.status != OLD.status THEN
    -- This would trigger AI analysis to determine new journey stage
    UPDATE public.lead_journey_stages
    SET updated_at = NOW()
    WHERE lead_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to update journey stage on lead changes
DROP TRIGGER IF EXISTS trigger_update_journey_stage ON public.leads;
CREATE TRIGGER trigger_update_journey_stage
  AFTER UPDATE OF lead_score, status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_stage();

-- Function to log sequence performance
CREATE OR REPLACE FUNCTION log_sequence_performance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update sequence performance metrics
  IF NEW.execution_status = 'executed' AND OLD.execution_status != 'executed' THEN
    UPDATE public.nurturing_sequences
    SET
      performance = jsonb_set(
        jsonb_set(
          performance,
          '{totalSent}',
          to_jsonb(COALESCE(performance->>'totalSent', '0')::int + 1)
        ),
        '{updated_at}',
        to_jsonb(NOW())
      ),
      updated_at = NOW()
    WHERE id = NEW.sequence_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to log sequence performance
DROP TRIGGER IF EXISTS trigger_log_sequence_performance ON public.sequence_stage_executions;
CREATE TRIGGER trigger_log_sequence_performance
  AFTER UPDATE OF execution_status ON public.sequence_stage_executions
  FOR EACH ROW
  EXECUTE FUNCTION log_sequence_performance();

-- =====================================
-- SEED DATA
-- =====================================

-- Insert default behavioral triggers
INSERT INTO public.behavioral_triggers (user_id, name, description, trigger_type, conditions, actions, priority) VALUES
('00000000-0000-0000-0000-000000000000', 'High Engagement Email Open', 'Trigger when lead opens email within 5 minutes', 'behavior',
 '{"behavior_type": "email_opened", "timeframe": "5_minutes"}',
 '[{"type": "send_follow_up", "delay": "1_hour", "channel": "email"}]', 10),

('00000000-0000-0000-0000-000000000000', 'Low Engagement Alert', 'Alert when lead hasn''t engaged for 7 days', 'time_based',
 '{"timeframe": "7_days", "engagement_threshold": 0}',
 '[{"type": "send_reengagement", "channel": "email"}, {"type": "create_task", "priority": "medium"}]', 8),

('00000000-0000-0000-0000-000000000000', 'High Lead Score Milestone', 'Trigger when lead score reaches 80+', 'score_change',
 '{"score_threshold": 80, "direction": "increase"}',
 '[{"type": "send_personalized_content", "content_type": "demo_invitation"}]', 9)

ON CONFLICT DO NOTHING;

-- Insert default sequence template
INSERT INTO public.nurturing_sequence_templates (user_id, name, description, category, stages) VALUES
('00000000-0000-0000-0000-000000000000', 'Welcome Sequence', 'Default welcome sequence for new leads', 'welcome',
 '[
   {
     "name": "Welcome Email",
     "type": "content",
     "content": {
       "type": "email",
       "subject": "Welcome to {{company_name}}",
       "body": "Thank you for your interest..."
     },
     "wait_time": 0
   },
   {
     "name": "Educational Content",
     "type": "content",
     "content": {
       "type": "email",
       "subject": "How to get started",
       "body": "Here are some tips..."
     },
     "wait_time": 1440
   },
   {
     "name": "Check Engagement",
     "type": "decision",
     "conditions": [
       {
         "type": "engagement_score",
         "operator": "greater_than",
         "value": 50
       }
     ],
     "next_stages": ["high_engagement", "low_engagement"]
   }
 ]'::jsonb)

ON CONFLICT DO NOTHING;