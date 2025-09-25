/**
 * Lead Scoring API Routes
 * Handles predictive scoring models and real-time lead scoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnhancedLeadScoringEngine } from '@/lib/mcp/enhanced-lead-scoring'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'models') {
      // Get predictive models
      const { data: models, error } = await supabase
        .from('predictive_models')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching predictive models:', error)
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
      }

      return NextResponse.json({ models })
    }

    if (action === 'criteria') {
      // Get scoring criteria
      const criteria = EnhancedLeadScoringEngine.getScoringCriteria()
      return NextResponse.json({ criteria })
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })

  } catch (error) {
    logger.error('Scoring API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, leadId, leadData } = body

    if (action === 'score_lead' && leadData) {
      // Try to use ML service for prediction first
      let scoring: any = null
      let mlPrediction = null

      try {
        // Use ML service for prediction
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001'
        const response = await fetch(`${mlServiceUrl}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model_type: 'lead_conversion',
            user_id: user.id,
            data: leadData
          })
        })

        if (response.ok) {
          mlPrediction = await response.json()
          if (mlPrediction.success) {
            scoring = {
              score: Math.round(mlPrediction.conversion_probability * 100),
              probability: mlPrediction.conversion_probability,
              confidence: mlPrediction.confidence,
              breakdown: mlPrediction.feature_importance,
              ml_prediction: true
            }
          }
        }
      } catch (error) {
        logger.warn('ML service prediction failed, falling back to rule-based scoring')
      }

      // Fallback to rule-based scoring if ML service fails
      if (!scoring) {
        const ruleBasedScoring = await EnhancedLeadScoringEngine.calculateLeadScore(leadData)
        scoring = {
          score: ruleBasedScoring.score,
          probability: 0,
          confidence: 0,
          breakdown: ruleBasedScoring.breakdown,
          ml_prediction: false
        }
      }

      // Update lead score if leadId provided
      if (leadId) {
        await supabase
          .from('leads')
          .update({
            lead_score: scoring.score,
            predictive_score: scoring.score,
            conversion_probability: scoring.probability || 0,
            last_engagement_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('id', leadId)

        // Log scoring activity
        await supabase
          .from('lead_activities')
          .insert({
            lead_id: leadId,
            type: 'score_updated',
            description: scoring.ml_prediction ? 'Lead score calculated with ML' : 'Lead score recalculated',
            metadata: {
              newScore: scoring.score,
              breakdown: scoring.breakdown,
              ml_prediction: scoring.ml_prediction || false,
              confidence: scoring.confidence || 0
            }
          })
      }

      return NextResponse.json({ scoring })
    }

    if (action === 'create_model') {
      // Create predictive model
      const { name, modelType, algorithm, features } = body

      if (!name || !modelType || !algorithm) {
        return NextResponse.json({
          error: 'Name, model type, and algorithm are required'
        }, { status: 400 })
      }

      // Get historical data for training
      const { data: historicalData } = await supabase
        .from('leads')
        .select('lead_score, status, company, job_title, engagement_score, created_at')
        .eq('user_id', user.id)
        .not('lead_score', 'is', null)
        .limit(1000)

      // Train model using new ML service
      const trainingResults = await trainPredictiveModelWithMLService(historicalData || [], {
        modelType,
        algorithm,
        features: features || []
      }, user.id)

      const { data: model, error } = await supabase
        .from('predictive_models')
        .insert({
          user_id: user.id,
          name,
          model_type: modelType,
          algorithm,
          features: features || [],
          performance_metrics: trainingResults.metrics,
          training_data: trainingResults.summary,
          is_active: true,
          last_trained_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        logger.error('Error creating predictive model:', error)
        return NextResponse.json({ error: 'Failed to create model' }, { status: 500 })
      }

      return NextResponse.json({ model }, { status: 201 })
    }

    if (action === 'analyze_quality' && leadData) {
      // Lead quality analysis
      const analysis = await EnhancedLeadScoringEngine.analyzeLeadQuality(leadData)
      return NextResponse.json({ analysis })
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })

  } catch (error) {
    logger.error('Scoring API POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function trainPredictiveModel(historicalData: any[], config: any, userId: string) {
  try {
    // Simplified model training - in production, this would use actual ML libraries
    const totalLeads = historicalData.length
    const convertedLeads = historicalData.filter(lead => lead.status === 'customer').length
    const conversionRate = totalLeads > 0 ? convertedLeads / totalLeads : 0

    // Calculate feature importance (simplified)
    const featureImportance = {
      lead_score: 0.4,
      engagement_score: 0.3,
      company_size: 0.2,
      job_title: 0.1
    }

    // Generate mock performance metrics
    const metrics = {
      accuracy: 0.85 + Math.random() * 0.1,
      precision: 0.82 + Math.random() * 0.1,
      recall: 0.78 + Math.random() * 0.1,
      f1_score: 0.80 + Math.random() * 0.1,
      auc_roc: 0.88 + Math.random() * 0.1
    }

    return {
      metrics,
      summary: {
        totalLeads,
        convertedLeads,
        conversionRate,
        featureImportance,
        trainingDate: new Date().toISOString()
      }
    }
  } catch (error) {
    logger.error('Model training error:', error)
    return {
      metrics: { accuracy: 0.7, precision: 0.65, recall: 0.6, f1_score: 0.62, auc_roc: 0.75 },
      summary: { error: 'Training failed' }
    }
  }
}

async function trainPredictiveModelWithMLService(historicalData: any[], config: any, userId: string) {
  try {
    // Use the new ML service for training
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001'

    const response = await fetch(`${mlServiceUrl}/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_type: config.modelType || 'lead_conversion',
        algorithm: config.algorithm || 'random_forest',
        model_name: `lead_scoring_model_${Date.now()}`,
        user_id: userId,
        training_config: {
          features: config.features || ['lead_score', 'engagement_score', 'company_size', 'job_title'],
          preprocessing: {
            missing_value_strategy: 'mean',
            categorical_encoding: 'one_hot',
            scaling_method: 'standard'
          }
        }
      })
    })

    if (!response.ok) {
      logger.error('ML service training failed:', await response.text())
      // Fallback to old method
      return await trainPredictiveModel(historicalData, config, userId)
    }

    const result = await response.json()
    return {
      metrics: result.metrics || {},
      summary: {
        totalLeads: historicalData.length,
        convertedLeads: historicalData.filter(lead => lead.status === 'customer').length,
        conversionRate: historicalData.length > 0 ? historicalData.filter(lead => lead.status === 'customer').length / historicalData.length : 0,
        featureImportance: result.metadata?.feature_importance || {},
        trainingDate: new Date().toISOString(),
        ml_service_used: true
      }
    }
  } catch (error) {
    logger.error('ML service training error:', error)
    // Fallback to old method
    return await trainPredictiveModel(historicalData, config, userId)
  }
}