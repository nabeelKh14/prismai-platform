-- PrismAI Branding Update Migration
-- This script updates existing database content to use PrismAI branding

-- Update existing assistant names from 'AI Receptionist' to 'PrismAI Assistant'
UPDATE public.ai_configs
SET assistant_name = 'PrismAI Assistant'
WHERE assistant_name = 'AI Receptionist';

-- Update subscription plan features to replace 'AI Receptionist' with 'PrismAI Assistant'
UPDATE public.subscription_plans
SET features = jsonb_set(
  features,
  '{0}',
  '"PrismAI Assistant"'
)
WHERE features @> '["AI Receptionist"]'::jsonb;

-- Update any system messages or notifications that might contain old branding
-- (Add specific updates as needed based on actual data found)

-- Update any default values in system configuration tables
-- (This would be customized based on actual system configuration tables)

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'PrismAI branding update completed successfully';
  RAISE NOTICE 'Updated assistant names and subscription plan features';
END $$;