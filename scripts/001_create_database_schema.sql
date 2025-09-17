-- Create database schema for PrismAI system

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  business_type TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Call logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  caller_name TEXT,
  call_duration INTEGER, -- in seconds
  call_status TEXT CHECK (call_status IN ('answered', 'missed', 'voicemail')),
  transcript TEXT,
  sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  booking_created BOOLEAN DEFAULT FALSE
);

-- Enable RLS for call_logs
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_logs
CREATE POLICY "call_logs_select_own" ON public.call_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "call_logs_insert_own" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "call_logs_update_own" ON public.call_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "call_logs_delete_own" ON public.call_logs FOR DELETE USING (auth.uid() = user_id);

-- Bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  service_type TEXT NOT NULL,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS policies for bookings
CREATE POLICY "bookings_select_own" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookings_insert_own" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_update_own" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bookings_delete_own" ON public.bookings FOR DELETE USING (auth.uid() = user_id);

-- AI assistant configurations
CREATE TABLE IF NOT EXISTS public.ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_name TEXT DEFAULT 'PrismAI Assistant',
  greeting_message TEXT DEFAULT 'Hello! Thank you for calling. How can I assist you today?',
  business_hours JSONB DEFAULT '{"monday": {"open": "09:00", "close": "17:00"}, "tuesday": {"open": "09:00", "close": "17:00"}, "wednesday": {"open": "09:00", "close": "17:00"}, "thursday": {"open": "09:00", "close": "17:00"}, "friday": {"open": "09:00", "close": "17:00"}, "saturday": {"open": "10:00", "close": "14:00"}, "sunday": {"closed": true}}',
  services JSONB DEFAULT '["General Consultation", "Appointment Booking", "Information Request"]',
  vapi_phone_number TEXT,
  vapi_assistant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS for ai_configs
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_configs
CREATE POLICY "ai_configs_select_own" ON public.ai_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_configs_insert_own" ON public.ai_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_configs_update_own" ON public.ai_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ai_configs_delete_own" ON public.ai_configs FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, business_name, business_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'My Business'),
    COALESCE(NEW.raw_user_meta_data ->> 'business_type', 'General')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ai_configs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
