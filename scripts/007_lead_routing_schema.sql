-- Lead Routing System Database Schema
-- Adds tables and functionality for priority-based lead routing

-- =====================================
-- LEAD ROUTING SYSTEM TABLES
-- =====================================

-- Priority scoring metadata for leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS business_value_score INTEGER DEFAULT 0 CHECK (business_value_score >= 0 AND business_value_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 0 CHECK (urgency_score >= 0 AND urgency_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS time_sensitivity_score INTEGER DEFAULT 0 CHECK (time_sensitivity_score >= 0 AND time_sensitivity_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_metadata JSONB DEFAULT '{}';

-- Lead assignment tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES auth.users(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMP WITH TIME ZONE;

-- Lead routing decisions log
CREATE TABLE IF NOT EXISTS public.lead_routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_agent_id UUID REFERENCES auth.users(id),
  routing_queue TEXT NOT NULL,
  priority_level TEXT CHECK (priority_level IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  reasoning JSONB DEFAULT '[]',
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  estimated_wait_time INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id, created_at)
);

-- Lead handoff events tracking
CREATE TABLE IF NOT EXISTS public.lead_handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES auth.users(id),
  to_agent_id UUID REFERENCES auth.users(id),
  handoff_type TEXT CHECK (handoff_type IN ('assignment', 'transfer', 'escalation', 'reassignment', 'timeout')) NOT NULL,
  reason TEXT NOT NULL,
  priority_level TEXT CHECK (priority_level IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Handoff optimization events
CREATE TABLE IF NOT EXISTS public.handoff_optimization_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  optimization_type TEXT CHECK (optimization_type IN ('load_balancing', 'skill_match', 'performance', 'priority_escalation')) NOT NULL,
  original_agent_id UUID REFERENCES auth.users(id),
  optimized_agent_id UUID REFERENCES auth.users(id),
  expected_improvement DECIMAL(5,4) CHECK (expected_improvement >= 0 AND expected_improvement <= 1),
  actual_improvement DECIMAL(5,4),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent availability and capacity tracking
CREATE TABLE IF NOT EXISTS public.agent_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_load INTEGER DEFAULT 0 CHECK (current_load >= 0),
  max_capacity INTEGER DEFAULT 10 CHECK (max_capacity > 0),
  skills TEXT[] DEFAULT '{}',
  average_response_time INTEGER DEFAULT 30, -- in minutes
  is_available BOOLEAN DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_id)
);

-- Agent skills and specializations
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level INTEGER CHECK (proficiency_level >= 1 AND proficiency_level <= 10),
  is_specialization BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_id, skill_name)
);

-- Agent performance metrics
CREATE TABLE IF NOT EXISTS public.agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leads_handled INTEGER DEFAULT 0,
  average_resolution_time INTEGER DEFAULT 0, -- in minutes
  success_rate DECIMAL(5,4) DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 1),
  customer_satisfaction DECIMAL(3,2) DEFAULT 0 CHECK (customer_satisfaction >= 0 AND customer_satisfaction <= 5),
  current_streak INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_id, updated_at::date)
);

-- Queue metrics history for performance tracking
CREATE TABLE IF NOT EXISTS public.queue_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  queue_name TEXT NOT NULL,
  lead_count INTEGER DEFAULT 0,
  average_wait_time INTEGER DEFAULT 0, -- in minutes
  max_wait_time INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  abandoned_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System logs for lead routing
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  component TEXT NOT NULL, -- 'routing', 'handoff', 'optimization', 'queue'
  level TEXT CHECK (level IN ('debug', 'info', 'warn', 'error')) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Lead routing indexes
CREATE INDEX IF NOT EXISTS idx_leads_priority_score ON public.leads(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON public.leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_priority_assigned ON public.leads(priority_score DESC, assigned_at);

-- Routing decisions indexes
CREATE INDEX IF NOT EXISTS idx_routing_decisions_user ON public.lead_routing_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_created ON public.lead_routing_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_priority ON public.lead_routing_decisions(priority_level, created_at DESC);

-- Handoff events indexes
CREATE INDEX IF NOT EXISTS idx_handoff_events_user ON public.lead_handoff_events(user_id);
CREATE INDEX IF NOT EXISTS idx_handoff_events_created ON public.lead_handoff_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_events_type ON public.lead_handoff_events(handoff_type, created_at DESC);

-- Agent availability indexes
CREATE INDEX IF NOT EXISTS idx_agent_availability_user ON public.agent_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_availability_available ON public.agent_availability(is_available, current_load);
CREATE INDEX IF NOT EXISTS idx_agent_availability_updated ON public.agent_availability(updated_at DESC);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_agent_performance_user ON public.agent_performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_updated ON public.agent_performance_metrics(updated_at DESC);

-- Queue metrics indexes
CREATE INDEX IF NOT EXISTS idx_queue_metrics_user ON public.queue_metrics_history(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_metrics_created ON public.queue_metrics_history(created_at DESC);

-- System logs indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_user ON public.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON public.system_logs(component, created_at DESC);

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- Enable RLS on new tables
ALTER TABLE public.lead_routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_handoff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_optimization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead routing tables
CREATE POLICY "routing_decisions_own" ON public.lead_routing_decisions USING (auth.uid() = user_id);
CREATE POLICY "handoff_events_own" ON public.lead_handoff_events USING (auth.uid() = user_id);
CREATE POLICY "optimization_events_own" ON public.handoff_optimization_events USING (auth.uid() = user_id);
CREATE POLICY "agent_availability_own" ON public.agent_availability USING (auth.uid() = user_id);
CREATE POLICY "agent_skills_own" ON public.agent_skills USING (auth.uid() = user_id);
CREATE POLICY "agent_performance_own" ON public.agent_performance_metrics USING (auth.uid() = user_id);
CREATE POLICY "queue_metrics_own" ON public.queue_metrics_history USING (auth.uid() = user_id);
CREATE POLICY "system_logs_own" ON public.system_logs USING (auth.uid() = user_id);

-- =====================================
-- FUNCTIONS AND TRIGGERS
-- =====================================

-- Function to update agent availability on lead assignment
CREATE OR REPLACE FUNCTION update_agent_availability_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update agent's current load
  UPDATE public.agent_availability
  SET
    current_load = current_load + 1,
    last_activity = NOW(),
    updated_at = NOW()
  WHERE user_id = NEW.user_id AND agent_id = NEW.assigned_agent_id;

  -- Log the assignment
  INSERT INTO public.system_logs (user_id, component, level, message, metadata)
  VALUES (
    NEW.user_id,
    'routing',
    'info',
    'Lead assigned to agent',
    jsonb_build_object(
      'lead_id', NEW.id,
      'agent_id', NEW.assigned_agent_id,
      'priority_score', NEW.priority_score
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update agent availability on lead assignment
DROP TRIGGER IF EXISTS trigger_update_agent_availability ON public.leads;
CREATE TRIGGER trigger_update_agent_availability
  AFTER UPDATE OF assigned_agent_id ON public.leads
  FOR EACH ROW
  WHEN (NEW.assigned_agent_id IS NOT NULL AND OLD.assigned_agent_id IS NULL)
  EXECUTE FUNCTION update_agent_availability_on_assignment();

-- Function to log queue metrics periodically
CREATE OR REPLACE FUNCTION log_queue_metrics()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  queue_stats RECORD;
BEGIN
  -- For each user, log current queue metrics
  FOR user_record IN SELECT DISTINCT user_id FROM public.leads WHERE user_id IS NOT NULL
  LOOP
    FOR queue_stats IN
      SELECT
        'priority_critical' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score >= 90
        AND assigned_agent_id IS NULL
      UNION ALL
      SELECT
        'priority_high' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score >= 75 AND priority_score < 90
        AND assigned_agent_id IS NULL
      UNION ALL
      SELECT
        'priority_medium' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score >= 50 AND priority_score < 75
        AND assigned_agent_id IS NULL
      UNION ALL
      SELECT
        'priority_low' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score < 50
        AND assigned_agent_id IS NULL
    LOOP
      INSERT INTO public.queue_metrics_history (
        user_id,
        queue_name,
        lead_count,
        created_at
      ) VALUES (
        user_record.user_id,
        queue_stats.queue_name,
        queue_stats.lead_count,
        NOW()
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- INITIAL DATA
-- =====================================

-- Insert default agent availability for existing users
INSERT INTO public.agent_availability (user_id, agent_id, current_load, max_capacity, is_available)
SELECT DISTINCT
  user_id,
  user_id as agent_id, -- Users can be their own agents initially
  0 as current_load,
  10 as max_capacity,
  true as is_available
FROM public.leads
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, agent_id) DO NOTHING;

-- Log initial system message
INSERT INTO public.system_logs (component, level, message, metadata)
VALUES (
  'routing',
  'info',
  'Lead routing system initialized',
  jsonb_build_object('timestamp', NOW())
);