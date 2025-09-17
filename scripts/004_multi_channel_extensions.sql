-- Multi-channel and multi-language extensions for chatbot
-- Extends the existing chat_conversations and chat_messages tables

-- Add language support to chat_conversations
ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS language_confidence DECIMAL(3,2) DEFAULT 1.0;

-- Add language detection and translation metadata to chat_messages
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS detected_language TEXT,
ADD COLUMN IF NOT EXISTS translated_from TEXT,
ADD COLUMN IF NOT EXISTS translated_to TEXT,
ADD COLUMN IF NOT EXISTS original_content TEXT; -- Store original message before translation

-- Add Twilio-specific fields for WhatsApp and SMS
ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS twilio_sid TEXT, -- Twilio message SID for tracking
ADD COLUMN IF NOT EXISTS external_conversation_id TEXT; -- External service conversation ID

-- Create customer language preferences table
CREATE TABLE IF NOT EXISTS public.customer_language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_identifier TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, customer_identifier)
);

-- Enable RLS
ALTER TABLE public.customer_language_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "customer_language_preferences_own" ON public.customer_language_preferences USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_lang_prefs_user_id ON public.customer_language_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_lang_prefs_identifier ON public.customer_language_preferences(customer_identifier);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_preferred_lang ON public.chat_conversations(preferred_language);
CREATE INDEX IF NOT EXISTS idx_chat_messages_detected_lang ON public.chat_messages(detected_language);

-- Update existing conversations to have default language
UPDATE public.chat_conversations
SET preferred_language = 'en'
WHERE preferred_language IS NULL;