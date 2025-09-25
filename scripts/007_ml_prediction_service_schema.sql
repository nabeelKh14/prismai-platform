-- ML Prediction Service Schema
-- Creates tables for machine learning models, training data, and predictions

-- ML Models table
CREATE TABLE IF NOT EXISTS public.ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  model_type TEXT CHECK (model_type IN ('lead_conversion', 'customer_lifetime_value', 'engagement_prediction', 'churn_prediction')) NOT NULL,
  algorithm TEXT CHECK (algorithm IN ('linear_regression', 'logistic_regression', 'random_forest', 'gradient_boosting', 'neural_network', 'xgboost')) NOT NULL,
  version TEXT NOT NULL,
  status TEXT CHECK (status IN ('training', 'active', 'inactive', 'deprecated')) DEFAULT 'training',
  parameters JSONB DEFAULT '{}',
  feature_importance JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  training_config JSONB DEFAULT '{}',
  model_metadata JSONB DEFAULT '{}',
  file_path TEXT, -- Path to saved model file
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trained_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, name, version)
);

-- Training datasets table
CREATE TABLE IF NOT EXISTS public.training_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data_source TEXT CHECK (data_source IN ('leads', 'customers', 'transactions', 'engagement')) NOT NULL,
  query_config JSONB DEFAULT '{}', -- Configuration for data extraction
  feature_columns TEXT[] NOT NULL,
  target_column TEXT,
  preprocessing_steps JSONB DEFAULT '[]',
  data_quality_score DECIMAL(3,2),
  record_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Training runs table
CREATE TABLE IF NOT EXISTS public.training_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.ml_models(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.training_datasets(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  parameters JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_by UUID REFERENCES auth.users(id)
);

-- Predictions table
CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.ml_models(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('lead', 'customer', 'prospect')) NOT NULL,
  entity_id UUID NOT NULL,
  prediction_type TEXT CHECK (prediction_type IN ('conversion_probability', 'lifetime_value', 'engagement_score', 'churn_risk')) NOT NULL,
  prediction_value DECIMAL(10,4) NOT NULL,
  confidence_score DECIMAL(3,2),
  prediction_factors JSONB DEFAULT '{}',
  input_features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, entity_type, entity_id, prediction_type)
);

-- Model performance tracking
CREATE TABLE IF NOT EXISTS public.model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.ml_models(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metric_metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data preprocessing pipelines
CREATE TABLE IF NOT EXISTS public.preprocessing_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]', -- Array of preprocessing steps
  input_schema JSONB DEFAULT '{}',
  output_schema JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Feature store for cached features
CREATE TABLE IF NOT EXISTS public.feature_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT CHECK (entity_type IN ('lead', 'customer', 'prospect')) NOT NULL,
  entity_id UUID NOT NULL,
  features JSONB NOT NULL,
  feature_version TEXT NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(entity_type, entity_id, feature_version)
);

-- Enable RLS on all tables
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preprocessing_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_store ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "ml_models_own" ON public.ml_models USING (auth.uid() = user_id);
CREATE POLICY "training_datasets_own" ON public.training_datasets USING (auth.uid() = user_id);
CREATE POLICY "training_runs_own" ON public.training_runs USING (auth.uid() = user_id);
CREATE POLICY "predictions_own" ON public.predictions USING (auth.uid() = user_id);
CREATE POLICY "model_performance_own" ON public.model_performance USING (auth.uid() = (SELECT user_id FROM public.ml_models WHERE id = model_id));
CREATE POLICY "preprocessing_pipelines_own" ON public.preprocessing_pipelines USING (auth.uid() = user_id);
CREATE POLICY "feature_store_own" ON public.feature_store USING (auth.uid() = (SELECT user_id FROM public.predictions WHERE entity_id = feature_store.entity_id LIMIT 1));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_models_user_id ON public.ml_models(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_models_type ON public.ml_models(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_models_status ON public.ml_models(status);
CREATE INDEX IF NOT EXISTS idx_ml_models_trained_at ON public.ml_models(trained_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_datasets_user_id ON public.training_datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_training_datasets_source ON public.training_datasets(data_source);

CREATE INDEX IF NOT EXISTS idx_training_runs_model_id ON public.training_runs(model_id);
CREATE INDEX IF NOT EXISTS idx_training_runs_status ON public.training_runs(status);
CREATE INDEX IF NOT EXISTS idx_training_runs_started_at ON public.training_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_model_id ON public.predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_predictions_entity ON public.predictions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_predictions_type ON public.predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON public.predictions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_performance_model_id ON public.model_performance(model_id);
CREATE INDEX IF NOT EXISTS idx_model_performance_recorded_at ON public.model_performance(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_preprocessing_pipelines_user_id ON public.preprocessing_pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_preprocessing_pipelines_active ON public.preprocessing_pipelines(is_active);

CREATE INDEX IF NOT EXISTS idx_feature_store_entity ON public.feature_store(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_feature_store_version ON public.feature_store(feature_version);
CREATE INDEX IF NOT EXISTS idx_feature_store_updated ON public.feature_store(last_updated DESC);

-- Function to update model last_used_at
CREATE OR REPLACE FUNCTION update_model_last_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ml_models
  SET last_used_at = NOW()
  WHERE id = NEW.model_id;

  RETURN NEW;
END;
$$;

-- Trigger to update model usage tracking
DROP TRIGGER IF EXISTS trigger_update_model_last_used ON public.predictions;
CREATE TRIGGER trigger_update_model_last_used
  AFTER INSERT ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_model_last_used();

-- Function to calculate model performance metrics
CREATE OR REPLACE FUNCTION calculate_model_performance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert performance tracking record
  INSERT INTO public.model_performance (model_id, metric_name, metric_value, metric_metadata)
  VALUES (
    NEW.model_id,
    'total_predictions',
    (SELECT COUNT(*) FROM public.predictions WHERE model_id = NEW.model_id),
    jsonb_build_object('prediction_type', NEW.prediction_type)
  );

  RETURN NEW;
END;
$$;

-- Trigger for performance tracking
DROP TRIGGER IF EXISTS trigger_calculate_model_performance ON public.predictions;
CREATE TRIGGER trigger_calculate_model_performance
  AFTER INSERT ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_model_performance();

-- Insert default preprocessing pipeline
INSERT INTO public.preprocessing_pipelines (user_id, name, description, steps) VALUES
('00000000-0000-0000-0000-000000000000', 'default_lead_preprocessing', 'Default preprocessing pipeline for lead data',
 '[
   {"type": "handle_missing", "config": {"strategy": "mean"}},
   {"type": "normalize", "config": {"method": "standard"}},
   {"type": "encode_categorical", "config": {"method": "one_hot"}},
   {"type": "feature_selection", "config": {"method": "correlation", "threshold": 0.1}}
 ]'::jsonb)
ON CONFLICT DO NOTHING;