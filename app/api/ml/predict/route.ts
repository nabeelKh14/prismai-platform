/**
 * ML Prediction API Route
 * Integrates with Python ML service for advanced predictions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { withErrorHandling, AuthenticationError } from '@/lib/errors'

interface PredictionRequest {
  modelType: 'lead_conversion' | 'customer_lifetime_value'
  leadId?: string
  customerId?: string
  leadData?: any
  customerData?: any
  modelName?: string
}

interface TrainingRequest {
  modelType: 'lead_conversion' | 'customer_lifetime_value'
  algorithm: 'random_forest' | 'gradient_boosting' | 'logistic_regression' | 'linear_regression' | 'neural_network'
  modelName: string
  trainingConfig?: any
}

// ML Service URL - in production, this would be configurable
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001'

class MLServiceClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async predict(data: PredictionRequest, userId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_type: data.modelType,
        user_id: userId,
        model_name: data.modelName,
        data: data.modelType === 'lead_conversion' ? data.leadData : data.customerData
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ML service error: ${error}`)
    }

    return response.json()
  }

  async batchPredict(data: any[], userId: string, modelType: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/predict/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_type: modelType,
        user_id: userId,
        data: data
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ML service batch prediction error: ${error}`)
    }

    return response.json()
  }

  async trainModel(data: TrainingRequest, userId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_type: data.modelType,
        algorithm: data.algorithm,
        model_name: data.modelName,
        user_id: userId,
        training_config: data.trainingConfig || {}
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ML service training error: ${error}`)
    }

    return response.json()
  }

  async getModels(userId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/models/${userId}`)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ML service models error: ${error}`)
    }

    return response.json()
  }

  async getInsights(userId: string, modelType: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/insights/${userId}/${modelType}`)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ML service insights error: ${error}`)
    }

    return response.json()
  }
}

const mlClient = new MLServiceClient(ML_SERVICE_URL)

// POST /api/ml/predict - Make predictions
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const body: PredictionRequest = await request.json()
  const { modelType, leadId, customerId, leadData, customerData, modelName } = body

  try {
    // Validate request
    if (!modelType) {
      return NextResponse.json(
        { error: 'modelType is required' },
        { status: 400 }
      )
    }

    // Get data from database if IDs provided
    let predictionData = leadData || customerData

    if (leadId && !predictionData) {
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', user.id)
        .single()

      if (!lead) {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        )
      }

      predictionData = lead
    }

    if (customerId && !predictionData) {
      // Get customer data (would need customer table)
      // For now, return error
      return NextResponse.json(
        { error: 'Customer data retrieval not implemented yet' },
        { status: 400 }
      )
    }

    if (!predictionData) {
      return NextResponse.json(
        { error: 'Either leadData/customerData or leadId/customerId is required' },
        { status: 400 }
      )
    }

    // Make prediction using ML service
    const result = await mlClient.predict(
      {
        modelType,
        leadData: modelType === 'lead_conversion' ? predictionData : undefined,
        customerData: modelType === 'customer_lifetime_value' ? predictionData : undefined,
        modelName
      },
      user.id
    )

    if (!result.success) {
      logger.error('ML prediction failed:', result.error)
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Store prediction in database
    if (leadId && modelType === 'lead_conversion') {
      await supabase
        .from('predictions')
        .insert({
          user_id: user.id,
          model_id: result.model_info?.model_path || 'unknown',
          entity_type: 'lead',
          entity_id: leadId,
          prediction_type: 'conversion_probability',
          prediction_value: result.conversion_probability,
          confidence_score: result.confidence,
          prediction_factors: result.feature_importance,
          input_features: predictionData
        })

      // Update lead with prediction
      await supabase
        .from('leads')
        .update({
          predictive_score: Math.round(result.conversion_probability * 100),
          conversion_probability: result.conversion_probability,
          estimated_value: result.lifetime_value || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      success: true,
      prediction: result,
      stored: !!leadId
    })

  } catch (error) {
    logger.error('ML prediction error:', error)
    return NextResponse.json(
      { error: 'Failed to make prediction' },
      { status: 500 }
    )
  }
})

// GET /api/ml/predict - Get prediction insights
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const modelType = searchParams.get('modelType')

  try {
    if (action === 'insights' && modelType) {
      const insights = await mlClient.getInsights(user.id, modelType)
      return NextResponse.json({ insights })
    }

    if (action === 'models') {
      const models = await mlClient.getModels(user.id)
      return NextResponse.json({ models: models.models })
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    )

  } catch (error) {
    logger.error('ML insights error:', error)
    return NextResponse.json(
      { error: 'Failed to get insights' },
      { status: 500 }
    )
  }
})

// PUT /api/ml/predict - Train new model
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const body: TrainingRequest = await request.json()
  const { modelType, algorithm, modelName, trainingConfig } = body

  try {
    // Validate request
    if (!modelType || !algorithm || !modelName) {
      return NextResponse.json(
        { error: 'modelType, algorithm, and modelName are required' },
        { status: 400 }
      )
    }

    // Start training
    const result = await mlClient.trainModel(
      {
        modelType,
        algorithm,
        modelName,
        trainingConfig
      },
      user.id
    )

    if (!result.success) {
      logger.error('ML training failed:', result.error)
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Store model info in database
    await supabase
      .from('ml_models')
      .insert({
        user_id: user.id,
        name: modelName,
        model_type: modelType,
        algorithm: algorithm,
        version: '1.0',
        status: 'active',
        parameters: result.metadata?.best_params || {},
        performance_metrics: result.metrics || {},
        training_config: trainingConfig || {},
        model_metadata: result.metadata || {},
        file_path: result.model_path,
        trained_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Model training started successfully',
      model_info: result.metadata
    })

  } catch (error) {
    logger.error('ML training error:', error)
    return NextResponse.json(
      { error: 'Failed to start training' },
      { status: 500 }
    )
  }
})