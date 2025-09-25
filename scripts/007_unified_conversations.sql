-- Unified conversations schema for simultaneous voice and text interactions
-- Extends existing chat and voice systems

-- Unified conversations table
CREATE TABLE IF NOT EXISTS public.unified_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_identifier TEXT NOT NULL, -- phone, email, session_id, etc.
  modality TEXT CHECK (modality IN ('voice', 'text', 'mixed')) DEFAULT 'text',
  channel TEXT CHECK (channel IN ('phone', 'website', 'whatsapp', 'sms', 'demo')) NOT NULL,
  status TEXT CHECK (status IN ('active', 'resolved', 'escalated', 'abandoned')) DEFAULT 'active',
  assigned_agent_id UUID REFERENCES auth.users(id),
  lead_id UUID REFERENCES public.leads(id),
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  metadata JSONB DEFAULT '{}', -- Store modality-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unified messages table
CREATE TABLE IF NOT EXISTS public.unified_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.unified_conversations(id) ON DELETE CASCADE,
  modality TEXT CHECK (modality IN ('voice', 'text')) NOT NULL,
  sender_type TEXT CHECK (sender_type IN ('customer', 'ai', 'agent')) NOT NULL,
  content TEXT, -- Text content or transcript
  audio_url TEXT, -- For voice messages
  sequence_number INTEGER NOT NULL, -- For ordering messages
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_time_ms INTEGER, -- Response time
  confidence_score DECIMAL(3,2), -- AI confidence for responses
  metadata JSONB DEFAULT '{}', -- Additional data (emotions, intents, etc.)
  UNIQUE(conversation_id, sequence_number)
);

-- Demo sessions table for demo environment
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  scenario TEXT, -- Pre-defined demo scenario
  status TEXT CHECK (status IN ('active', 'completed', 'paused')) DEFAULT 'active',
  recording_enabled BOOLEAN DEFAULT false, -- PRIVACY BY DESIGN: Default to false to prevent unauthorized recording - users must explicitly consent to recording
  metrics JSONB DEFAULT '{}', -- Real-time metrics during demo
  conversation_id UUID REFERENCES public.unified_conversations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Demo recordings table
CREATE TABLE IF NOT EXISTS public.demo_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id UUID NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.unified_messages(id),
  modality TEXT CHECK (modality IN ('voice', 'text')) NOT NULL,
  recording_url TEXT, -- URL to stored recording
  transcript TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Synchronization queue for response management
CREATE TABLE IF NOT EXISTS public.response_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.unified_conversations(id) ON DELETE CASCADE,
  modality TEXT CHECK (modality IN ('voice', 'text')) NOT NULL,
  priority INTEGER DEFAULT 1, -- 1=normal, 2=high, 3=urgent
  status TEXT CHECK (status IN ('queued', 'processing', 'completed', 'failed')) DEFAULT 'queued',
  payload JSONB NOT NULL, -- Response data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.unified_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "unified_conversations_own" ON public.unified_conversations USING (auth.uid() = user_id);
CREATE POLICY "unified_messages_own" ON public.unified_messages USING (auth.uid() = (SELECT user_id FROM public.unified_conversations WHERE id = conversation_id));
CREATE POLICY "demo_sessions_own" ON public.demo_sessions USING (auth.uid() = user_id);
CREATE POLICY "demo_recordings_own" ON public.demo_recordings USING (auth.uid() = (SELECT user_id FROM public.demo_sessions WHERE id = demo_session_id));
CREATE POLICY "response_queue_own" ON public.response_queue USING (auth.uid() = (SELECT user_id FROM public.unified_conversations WHERE id = conversation_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_conversations_user_id ON public.unified_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_status ON public.unified_conversations(status);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_customer ON public.unified_conversations(customer_identifier);
CREATE INDEX IF NOT EXISTS idx_unified_messages_conversation_id ON public.unified_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_sequence ON public.unified_messages(conversation_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_unified_messages_timestamp ON public.unified_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_user_id ON public.demo_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_status ON public.demo_sessions(status);
CREATE INDEX IF NOT EXISTS idx_response_queue_conversation ON public.response_queue(conversation_id);
CREATE INDEX IF NOT EXISTS idx_response_queue_status ON public.response_queue(status, priority DESC);

-- Function to get next sequence number for messages
CREATE OR REPLACE FUNCTION get_next_message_sequence(conv_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO next_seq
  FROM public.unified_messages
  WHERE conversation_id = conv_id;

  RETURN next_seq;
END;
$$;

-- Function to update conversation updated_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.unified_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- Trigger to update conversation timestamp on new messages
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.unified_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();