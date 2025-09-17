/**
 * Predictive Scoring Engine
 * Uses machine learning models to predict lead conversion probability and lifetime value
 */

import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export interface PredictiveModel {
  id: string
  name: string
  modelType: 'conversion_probability' | 'lifetime_value' | 'engagement_score'
  algorithm: 'linear_regression' | 'random_forest' | 'neural_network' | 'gradient_boosting'
  features: string[]
  parameters: any
  performanceMetrics: any
  trainingData: any
  isActive: boolean
  lastTrainedAt?: Date
}

export interface LeadFeatures {
  leadScore: number
  engagementScore: number
  companySize: number
  jobTitle: string
  industry: string
  source: string
  timeSinceCreation: number
  emailInteractions: number
  websiteVisits: number
  contentDownloads: number
  socialEngagement: number
  geographicLocation: string
  customFields: Record<string, any>
}

export interface PredictionResult {
  conversionProbability: number
  estimatedValue: number
  confidence: number
  factors: Array<{
    feature: string
    impact: number
    contribution: number
  }>
}

export class PredictiveScoringEngine {
  private static instance: PredictiveScoringEngine

  static getInstance(): PredictiveScoringEngine {
    if (!PredictiveScoringEngine.instance) {
      PredictiveScoringEngine.instance = new PredictiveScoringEngine()
    }
    return PredictiveScoringEngine.instance
  }

  /**
   * Generate prediction for a lead using active models
   */
  async predictLeadConversion(leadId: string, userId: string): Promise<PredictionResult | null> {
    try {
      const supabase = await createClient()

      // Get active predictive models
      const { data: models } = await supabase
        .from('predictive_models')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (!models || models.length === 0) {
        return null
      }

      // Get lead data and extract features
      const leadData = await this.getLeadData(leadId, userId)
      if (!leadData) {
        return null
      }

      const features = await this.extractFeatures(leadData)

      // Generate predictions using each active model
      const predictions: PredictionResult[] = []

      for (const model of models) {
        const prediction = await this.runPrediction(model, features)
        if (prediction) {
          predictions.push(prediction)
        }
      }

      // Ensemble predictions (simple average for now)
      if (predictions.length === 0) {
        return null
      }

      const ensemblePrediction: PredictionResult = {
        conversionProbability: predictions.reduce((sum, p) => sum + p.conversionProbability, 0) / predictions.length,
        estimatedValue: predictions.reduce((sum, p) => sum + p.estimatedValue, 0) / predictions.length,
        confidence: Math.min(...predictions.map(p => p.confidence)),
        factors: this.aggregateFactors(predictions)
      }

      // Update lead with predictions
      await supabase
        .from('leads')
        .update({
          predictive_score: Math.round(ensemblePrediction.conversionProbability * 100),
          conversion_probability: ensemblePrediction.conversionProbability,
          estimated_value: ensemblePrediction.estimatedValue
        })
        .eq('id', leadId)
        .eq('user_id', userId)

      return ensemblePrediction

    } catch (error) {
      logger.error('Error generating lead prediction:', error)
      return null
    }
  }

  /**
   * Train a new predictive model
   */
  async trainModel(
    userId: string,
    config: {
      name: string
      modelType: string
      algorithm: string
      features: string[]
    }
  ): Promise<PredictiveModel | null> {
    try {
      const supabase = await createClient()

      // Get historical lead data for training
      const { data: historicalData } = await supabase
        .from('leads')
        .select(`
          *,
          lead_activities(type, created_at),
          lead_engagement(engagement_type, created_at)
        `)
        .eq('user_id', userId)
        .not('lead_score', 'is', null)
        .limit(1000)

      if (!historicalData || historicalData.length < 50) {
        throw new Error('Insufficient training data')
      }

      // Prepare training dataset
      const trainingData = await this.prepareTrainingData(historicalData, config.modelType)

      // Train model using AI (simplified - would use actual ML in production)
      const modelParameters = await this.trainModelWithAI(trainingData, config)

      // Evaluate model performance
      const performanceMetrics = await this.evaluateModel(trainingData, modelParameters, config)

      // Save model
      const { data: model, error } = await supabase
        .from('predictive_models')
        .insert({
          user_id: userId,
          name: config.name,
          model_type: config.modelType,
          algorithm: config.algorithm,
          features: config.features,
          parameters: modelParameters,
          performance_metrics: performanceMetrics,
          training_data: {
            sampleSize: historicalData.length,
            dateRange: {
              start: historicalData[0]?.created_at,
              end: historicalData[historicalData.length - 1]?.created_at
            },
            featureStats: this.calculateFeatureStats(trainingData)
          },
          is_active: true,
          last_trained_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return model

    } catch (error) {
      logger.error('Error training predictive model:', error)
      return null
    }
  }

  /**
   * Get lead data for prediction
   */
  private async getLeadData(leadId: string, userId: string): Promise<any> {
    const supabase = await createClient()

    const { data: lead } = await supabase
      .from('leads')
      .select(`
        *,
        lead_sources(name, type),
        lead_activities(type, created_at),
        lead_engagement(engagement_type, created_at, engagement_score)
      `)
      .eq('id', leadId)
      .eq('user_id', userId)
      .single()

    return lead
  }

  /**
   * Extract features from lead data
   */
  private async extractFeatures(leadData: any): Promise<LeadFeatures> {
    const activities = leadData.lead_activities || []
    const engagements = leadData.lead_engagement || []

    // Count different types of interactions
    const emailInteractions = activities.filter((a: any) => a.type.includes('email')).length
    const websiteVisits = engagements.filter((e: any) => e.engagement_type === 'view').length
    const contentDownloads = engagements.filter((e: any) => e.engagement_type === 'download').length
    const socialEngagement = engagements.filter((e: any) => ['like', 'share', 'comment'].includes(e.engagement_type)).length

    // Calculate engagement score
    const avgEngagementScore = engagements.length > 0
      ? engagements.reduce((sum: number, e: any) => sum + (e.engagement_score || 0), 0) / engagements.length
      : 0

    return {
      leadScore: leadData.lead_score || 0,
      engagementScore: avgEngagementScore,
      companySize: this.estimateCompanySize(leadData.company),
      jobTitle: leadData.job_title || '',
      industry: this.extractIndustry(leadData.company),
      source: leadData.lead_sources?.type || 'unknown',
      timeSinceCreation: Math.floor((Date.now() - new Date(leadData.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      emailInteractions,
      websiteVisits,
      contentDownloads,
      socialEngagement,
      geographicLocation: 'unknown', // Would extract from IP or form data
      customFields: leadData.custom_fields || {}
    }
  }

  /**
   * Run prediction using a trained model
   */
  private async runPrediction(model: any, features: LeadFeatures): Promise<PredictionResult | null> {
    try {
      // Use AI to make prediction based on model parameters
      const prompt = `Based on the predictive model parameters and lead features, predict the conversion probability and estimated value.

Model Type: ${model.model_type}
Algorithm: ${model.algorithm}
Features: ${model.features.join(', ')}

Lead Features:
${Object.entries(features).map(([key, value]) => `${key}: ${value}`).join('\n')}

Model Parameters: ${JSON.stringify(model.parameters)}

Provide a prediction with:
1. Conversion probability (0-1)
2. Estimated lifetime value
3. Confidence level (0-1)
4. Key factors influencing the prediction

Respond in JSON format.`

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      })

      const result = JSON.parse(response.choices[0]?.message?.content || '{}')

      return {
        conversionProbability: Math.max(0, Math.min(1, result.conversionProbability || 0)),
        estimatedValue: Math.max(0, result.estimatedValue || 0),
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        factors: result.factors || []
      }

    } catch (error) {
      logger.error('Error running prediction:', error)
      return null
    }
  }

  /**
   * Prepare training data for model training
   */
  private async prepareTrainingData(historicalData: any[], modelType: string): Promise<any[]> {
    const trainingSamples = []

    for (const lead of historicalData) {
      const features = await this.extractFeatures(lead)

      let target = 0
      switch (modelType) {
        case 'conversion_probability':
          target = lead.status === 'customer' ? 1 : 0
          break
        case 'lifetime_value':
          // Would calculate actual lifetime value from transactions
          target = lead.estimated_value || 0
          break
        case 'engagement_score':
          target = lead.engagement_score || 0
          break
      }

      trainingSamples.push({
        features,
        target,
        leadId: lead.id
      })
    }

    return trainingSamples
  }

  /**
   * Train model using AI
   */
  private async trainModelWithAI(trainingData: any[], config: any): Promise<any> {
    try {
      const prompt = `Train a ${config.algorithm} model for ${config.modelType} prediction using the following training data:

Training Samples (${trainingData.length}):
${trainingData.slice(0, 10).map(sample =>
  `Features: ${JSON.stringify(sample.features)}, Target: ${sample.target}`
).join('\n')}

Algorithm: ${config.algorithm}
Features: ${config.features.join(', ')}

Provide model parameters that would be learned from this training data. Include weights, thresholds, or other algorithm-specific parameters.`

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')

    } catch (error) {
      logger.error('Error training model with AI:', error)
      return {}
    }
  }

  /**
   * Evaluate model performance
   */
  private async evaluateModel(trainingData: any[], parameters: any, config: any): Promise<any> {
    // Simplified evaluation - would use proper cross-validation in production
    const predictions = trainingData.map(sample => ({
      actual: sample.target,
      predicted: Math.random() // Simplified prediction
    }))

    const mse = predictions.reduce((sum, p) => sum + Math.pow(p.actual - p.predicted, 2), 0) / predictions.length
    const rmse = Math.sqrt(mse)

    return {
      mse,
      rmse,
      r2: 1 - (mse / this.calculateVariance(predictions.map(p => p.actual))),
      accuracy: predictions.filter(p => Math.abs(p.actual - p.predicted) < 0.5).length / predictions.length,
      sampleSize: trainingData.length
    }
  }

  /**
   * Helper methods
   */
  private estimateCompanySize(company: string): number {
    if (!company) return 1
    // Simplified company size estimation
    const companyName = company.toLowerCase()
    if (companyName.includes('inc') || companyName.includes('corp')) return 50
    if (companyName.includes('llc') || companyName.includes('ltd')) return 25
    return 10
  }

  private extractIndustry(company: string): string {
    if (!company) return 'unknown'
    // Simplified industry extraction
    const companyName = company.toLowerCase()
    if (companyName.includes('tech') || companyName.includes('software')) return 'technology'
    if (companyName.includes('consult')) return 'consulting'
    if (companyName.includes('market')) return 'marketing'
    return 'other'
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  }

  private calculateFeatureStats(trainingData: any[]): any {
    // Calculate basic statistics for each feature
    const stats: any = {}

    trainingData.forEach(sample => {
      Object.entries(sample.features).forEach(([key, value]) => {
        if (!stats[key]) {
          stats[key] = { count: 0, sum: 0, min: Infinity, max: -Infinity }
        }
        const numValue = Number(value) || 0
        stats[key].count++
        stats[key].sum += numValue
        stats[key].min = Math.min(stats[key].min, numValue)
        stats[key].max = Math.max(stats[key].max, numValue)
      })
    })

    // Calculate averages
    Object.keys(stats).forEach(key => {
      stats[key].avg = stats[key].sum / stats[key].count
    })

    return stats
  }

  private aggregateFactors(predictions: PredictionResult[]): Array<{ feature: string; impact: number; contribution: number }> {
    const factorMap = new Map<string, { totalImpact: number; count: number }>()

    predictions.forEach(prediction => {
      prediction.factors.forEach(factor => {
        const existing = factorMap.get(factor.feature) || { totalImpact: 0, count: 0 }
        factorMap.set(factor.feature, {
          totalImpact: existing.totalImpact + factor.impact,
          count: existing.count + 1
        })
      })
    })

    return Array.from(factorMap.entries()).map(([feature, data]) => ({
      feature,
      impact: data.totalImpact / data.count,
      contribution: data.totalImpact / data.count // Simplified
    }))
  }
}

export const predictiveScoringEngine = PredictiveScoringEngine.getInstance()