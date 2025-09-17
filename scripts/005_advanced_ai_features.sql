-- Advanced AI Features: Sentiment Analysis, Escalation Rules, and Summarization
-- Extends the existing chat system with AI-powered features

-- Add sentiment tracking to chat_conversations
ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'declining', 'stable')),
ADD COLUMN IF NOT EXISTS urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high')) DEFAULT 'low',
ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium';

-- Add AI analysis metadata to chat_messages
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS sentiment_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS emotions TEXT[],
ADD COLUMN IF NOT EXISTS topics TEXT[],
ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('low', 'medium', 'high'));

-- Create escalation rules table
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}', -- Rule conditions
  actions JSONB NOT NULL DEFAULT '[]', -- Actions to take when rule triggers
  priority INTEGER DEFAULT 1, -- Rule priority (higher = more important)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create conversation summaries table for advanced analytics
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points TEXT[],
  sentiment_summary TEXT,
  resolution_status TEXT CHECK (resolution_status IN ('resolved', 'escalated', 'abandoned', 'ongoing')),
  generated_by TEXT CHECK (generated_by IN ('auto', 'manual')) DEFAULT 'auto',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create escalation logs table
CREATE TABLE IF NOT EXISTS public.escalation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.escalation_rules(id),
  reason TEXT NOT NULL,
  triggered_by TEXT CHECK (triggered_by IN ('sentiment', 'keyword', 'time', 'manual', 'complexity')),
  old_status TEXT,
  new_status TEXT,
  assigned_agent UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "escalation_rules_own" ON public.escalation_rules USING (auth.uid() = user_id);
CREATE POLICY "conversation_summaries_own" ON public.conversation_summaries USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "escalation_logs_own" ON public.escalation_logs USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_sentiment_score ON public.chat_conversations(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_urgency_level ON public.chat_conversations(urgency_level);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_priority ON public.chat_conversations(priority);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status_updated ON public.chat_conversations(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sentiment_score ON public.chat_messages(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_chat_messages_urgency ON public.chat_messages(urgency);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_user_id ON public.escalation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON public.escalation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conversation_id ON public.conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_conversation_id ON public.escalation_logs(conversation_id);

-- Function to update conversation sentiment aggregates
CREATE OR REPLACE FUNCTION update_conversation_sentiment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update conversation sentiment when message sentiment changes
  IF NEW.sentiment_score IS NOT NULL THEN
    UPDATE public.chat_conversations
    SET
      sentiment_score = (
        SELECT AVG(sentiment_score)
        FROM public.chat_messages
        WHERE conversation_id = NEW.conversation_id
          AND sentiment_score IS NOT NULL
      ),
      urgency_level = (
        SELECT
          CASE
            WHEN AVG(sentiment_score) < -0.3 THEN 'high'
            WHEN AVG(sentiment_score) < 0 THEN 'medium'
            ELSE 'low'
          END
        FROM public.chat_messages
        WHERE conversation_id = NEW.conversation_id
          AND sentiment_score IS NOT NULL
      ),
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to automatically update conversation sentiment
DROP TRIGGER IF EXISTS trigger_update_conversation_sentiment ON public.chat_messages;
CREATE TRIGGER trigger_update_conversation_sentiment
  AFTER INSERT OR UPDATE OF sentiment_score ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_sentiment();

-- Function to automatically generate conversation summary on resolution
CREATE OR REPLACE FUNCTION generate_conversation_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate summary when conversation is resolved
  IF NEW.status IN ('resolved', 'escalated') AND (OLD.status IS NULL OR OLD.status NOT IN ('resolved', 'escalated')) THEN
    -- Insert summary record (will be populated by AI later)
    INSERT INTO public.conversation_summaries (conversation_id, summary, resolution_status, generated_by)
    VALUES (NEW.id, '', NEW.status, 'auto')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to automatically create summary on conversation resolution
DROP TRIGGER IF EXISTS trigger_generate_conversation_summary ON public.chat_conversations;
CREATE TRIGGER trigger_generate_conversation_summary
  AFTER UPDATE OF status ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION generate_conversation_summary();

-- Insert default escalation rules
INSERT INTO public.escalation_rules (user_id, name, description, conditions, actions, priority) VALUES
-- This will be inserted for each user when they first use the system
-- For now, we'll create a template that can be cloned per user
('00000000-0000-0000-0000-000000000000', 'High Negative Sentiment', 'Escalate when customer sentiment is very negative', '{"sentiment_score": {"operator": "<", "value": -0.5}}', '[{"type": "escalate", "priority": "high"}, {"type": "notify_agent", "message": "Customer is very frustrated"}]', 10),
('00000000-0000-0000-0000-000000000000', 'Urgent Keywords', 'Escalate when urgent keywords are detected', '{"keywords": ["urgent", "asap", "emergency", "critical"]}', '[{"type": "escalate", "priority": "urgent"}, {"type": "notify_supervisor", "message": "Urgent customer request"}]', 8),
('00000000-0000-0000-0000-000000000000', 'Long Conversation', 'Escalate after 10+ messages without resolution', '{"message_count": {"operator": ">", "value": 10}}', '[{"type": "escalate", "priority": "medium"}, {"type": "suggest_human_handoff", "message": "Conversation is getting long"}]', 5)
ON CONFLICT DO NOTHING;