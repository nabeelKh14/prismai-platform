/**
 * Real-time Content Adaptation Engine
 * Dynamically adapts content based on lead behavior, preferences, and engagement patterns
 */

import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export interface ContentAdaptationStrategy {
  id: string
  leadId: string
  strategyType: 'tone' | 'complexity' | 'length' | 'format' | 'frequency' | 'channel'
  originalValue: string
  adaptedValue: string
  adaptationReason: string
  confidenceScore: number
  appliedAt: Date
  createdAt: Date
}

export interface ContentTemplate {
  id: string
  type: 'email' | 'sms' | 'whatsapp' | 'chat' | 'notification'
  subject?: string
  body: string
  variables: Record<string, string>
  metadata: ContentMetadata
  personalizationTags: string[]
  adaptationHistory: ContentAdaptationStrategy[]
}

export interface ContentMetadata {
  category: string
  topic: string
  targetAudience: string
  complexity: 'basic' | 'intermediate' | 'advanced'
  tone: 'formal' | 'casual' | 'professional' | 'friendly'
  length: 'short' | 'medium' | 'long'
  format: 'text' | 'html' | 'markdown'
  language: string
  industry?: string
  useCase?: string
}

export interface LeadContentPreferences {
  preferredComplexity: 'basic' | 'intermediate' | 'advanced'
  preferredTone: 'formal' | 'casual' | 'professional' | 'friendly'
  preferredLength: 'short' | 'medium' | 'long'
  preferredFormat: 'text' | 'html' | 'markdown'
  preferredChannels: string[]
  contentTopics: string[]
  engagementPatterns: EngagementPattern[]
}

export interface EngagementPattern {
  contentType: string
  engagementRate: number
  avgReadTime: number
  clickThroughRate: number
  conversionRate: number
  lastEngagement: Date
  frequency: number
}

export interface ContentPerformance {
  id: string
  leadId: string
  contentId: string
  sentAt: Date
  openedAt?: Date
  clickedAt?: Date
  repliedAt?: Date
  convertedAt?: Date
  engagementScore: number
  performanceMetrics: PerformanceMetrics
  createdAt: Date
}

export interface PerformanceMetrics {
  openRate: number
  clickRate: number
  replyRate: number
  conversionRate: number
  bounceRate: number
  unsubscribeRate: number
  engagementTime: number
  sentimentScore: number
}

export class ContentAdaptationEngine {
  private static instance: ContentAdaptationEngine
  private contentCache: Map<string, ContentTemplate[]> = new Map()
  private adaptationStrategies: Map<string, ContentAdaptationStrategy[]> = new Map()

  constructor() {}

  static getInstance(): ContentAdaptationEngine {
    if (!ContentAdaptationEngine.instance) {
      ContentAdaptationEngine.instance = new ContentAdaptationEngine()
    }
    return ContentAdaptationEngine.instance
  }

  /**
   * Initialize content adaptation engine for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      logger.info('Initializing content adaptation engine', { userId })

      // Load content templates
      await this.loadContentTemplates(userId)

      // Load adaptation strategies
      await this.loadAdaptationStrategies(userId)

      logger.info('Content adaptation engine initialized', { userId })
    } catch (error) {
      logger.error('Error initializing content adaptation engine', error as Error, { userId })
      throw error
    }
  }

  /**
   * Adapt content for a specific lead based on their preferences and behavior
   */
  async adaptContentForLead(
    leadId: string,
    baseContent: ContentTemplate,
    context: Record<string, any>,
    userId: string
  ): Promise<ContentTemplate> {
    try {
      // Get lead preferences
      const preferences = await this.getLeadContentPreferences(leadId, userId)

      // Analyze content performance history
      const performance = await this.analyzeContentPerformance(leadId, userId)

      // Generate adaptation strategy
      const adaptation = await this.generateAdaptationStrategy(
        baseContent,
        preferences,
        performance,
        context,
        userId
      )

      // Apply adaptations
      const adaptedContent = await this.applyAdaptationStrategy(baseContent, adaptation, userId)

      // Store adaptation strategy
      await this.storeAdaptationStrategy(leadId, adaptation, userId)

      logger.info('Adapted content for lead', {
        leadId,
        contentId: baseContent.id,
        adaptations: adaptation.length,
        userId
      })

      return adaptedContent
    } catch (error) {
      logger.error('Error adapting content for lead', error as Error, { leadId, contentId: baseContent.id })
      return baseContent // Return original content if adaptation fails
    }
  }

  /**
   * Generate personalized content based on lead profile and context
   */
  async generatePersonalizedContent(
    leadId: string,
    contentType: 'email' | 'sms' | 'whatsapp' | 'chat',
    context: Record<string, any>,
    userId: string
  ): Promise<ContentTemplate> {
    try {
      // Get lead preferences and profile
      const preferences = await this.getLeadContentPreferences(leadId, userId)
      const profile = await this.getLeadProfile(leadId, userId)

      // Get relevant content templates
      const templates = await this.getRelevantTemplates(contentType, context, userId)

      // Select best template
      const selectedTemplate = await this.selectOptimalTemplate(templates, preferences, profile, context)

      // Adapt template for lead
      const adaptedContent = await this.adaptContentForLead(leadId, selectedTemplate, context, userId)

      return adaptedContent
    } catch (error) {
      logger.error('Error generating personalized content', error as Error, { leadId, contentType })
      throw error
    }
  }

  /**
   * Analyze content performance and suggest improvements
   */
  async analyzeContentPerformance(leadId: string, userId: string): Promise<ContentPerformance[]> {
    try {
      const supabase = await createClient()

      const { data: performances } = await supabase
        .from('content_performance')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(50)

      return performances?.map(p => ({
        id: p.id,
        leadId: p.lead_id,
        contentId: p.content_id,
        sentAt: new Date(p.sent_at),
        openedAt: p.opened_at ? new Date(p.opened_at) : undefined,
        clickedAt: p.clicked_at ? new Date(p.clicked_at) : undefined,
        repliedAt: p.replied_at ? new Date(p.replied_at) : undefined,
        convertedAt: p.converted_at ? new Date(p.converted_at) : undefined,
        engagementScore: p.engagement_score,
        performanceMetrics: p.performance_metrics,
        createdAt: new Date(p.created_at)
      })) || []
    } catch (error) {
      logger.error('Error analyzing content performance', error as Error, { leadId })
      return []
    }
  }

  /**
   * Optimize content strategy based on performance data
   */
  async optimizeContentStrategy(userId: string): Promise<void> {
    try {
      // Get all leads for user
      const supabase = await createClient()

      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')

      for (const lead of leads || []) {
        // Analyze performance for each lead
        const performance = await this.analyzeContentPerformance(lead.id, userId)

        if (performance.length > 0) {
          // Generate optimization recommendations
          const optimizations = await this.generateOptimizationRecommendations(lead.id, performance, userId)

          // Apply optimizations
          await this.applyOptimizations(lead.id, optimizations, userId)
        }
      }

      logger.info('Content strategy optimization completed', { userId })
    } catch (error) {
      logger.error('Error optimizing content strategy', error as Error, { userId })
    }
  }

  /**
   * Get content templates for a specific type and context
   */
  async getContentTemplates(
    contentType: string,
    context: Record<string, any>,
    userId: string
  ): Promise<ContentTemplate[]> {
    try {
      const cacheKey = `${userId}:${contentType}:${JSON.stringify(context)}`
      const cached = this.contentCache.get(cacheKey)

      if (cached) {
        return cached
      }

      const supabase = await createClient()

      // Get templates from database based on context
      const { data: templates } = await supabase
        .from('content_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('type', contentType)
        .eq('is_active', true)

      const formattedTemplates: ContentTemplate[] = (templates || []).map(template => ({
        id: template.id,
        type: template.type,
        subject: template.subject,
        body: template.body,
        variables: template.variables || {},
        metadata: template.metadata || {},
        personalizationTags: template.personalization_tags || [],
        adaptationHistory: []
      }))

      // Cache templates
      this.contentCache.set(cacheKey, formattedTemplates)

      return formattedTemplates
    } catch (error) {
      logger.error('Error getting content templates', error as Error, { contentType, userId })
      return []
    }
  }

  // Private helper methods

  private async loadContentTemplates(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: templates } = await supabase
        .from('content_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      for (const template of templates || []) {
        const cacheKey = `${userId}:${template.type}:default`
        const existing = this.contentCache.get(cacheKey) || []
        existing.push({
          id: template.id,
          type: template.type,
          subject: template.subject,
          body: template.body,
          variables: template.variables || {},
          metadata: template.metadata || {},
          personalizationTags: template.personalization_tags || [],
          adaptationHistory: []
        })
        this.contentCache.set(cacheKey, existing)
      }

      logger.info('Loaded content templates', { count: templates?.length || 0, userId })
    } catch (error) {
      logger.error('Error loading content templates', error as Error, { userId })
    }
  }

  private async loadAdaptationStrategies(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: strategies } = await supabase
        .from('content_adaptation_strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000)

      for (const strategy of strategies || []) {
        const leadStrategies = this.adaptationStrategies.get(strategy.lead_id) || []
        leadStrategies.push({
          id: strategy.id,
          leadId: strategy.lead_id,
          strategyType: strategy.strategy_type,
          originalValue: strategy.original_value,
          adaptedValue: strategy.adapted_value,
          adaptationReason: strategy.adaptation_reason,
          confidenceScore: strategy.confidence_score,
          appliedAt: new Date(strategy.applied_at),
          createdAt: new Date(strategy.created_at)
        })
        this.adaptationStrategies.set(strategy.lead_id, leadStrategies)
      }

      logger.info('Loaded adaptation strategies', { count: strategies?.length || 0, userId })
    } catch (error) {
      logger.error('Error loading adaptation strategies', error as Error, { userId })
    }
  }

  private async getLeadContentPreferences(leadId: string, userId: string): Promise<LeadContentPreferences> {
    try {
      const supabase = await createClient()

      // Get lead preferences from database
      const { data: preferences } = await supabase
        .from('lead_preferences')
        .select('*')
        .eq('lead_id', leadId)
        .single()

      if (preferences) {
        return {
          preferredComplexity: preferences.preferred_complexity || 'intermediate',
          preferredTone: preferences.preferred_tone || 'professional',
          preferredLength: preferences.preferred_length || 'medium',
          preferredFormat: preferences.preferred_format || 'text',
          preferredChannels: preferences.preferred_channels || ['email'],
          contentTopics: preferences.content_topics || [],
          engagementPatterns: await this.getEngagementPatterns(leadId, userId)
        }
      }

      // Infer preferences from behavior if not explicitly set
      return await this.inferContentPreferences(leadId, userId)
    } catch (error) {
      logger.error('Error getting lead content preferences', error as Error, { leadId })
      return this.getDefaultPreferences()
    }
  }

  private async getEngagementPatterns(leadId: string, userId: string): Promise<EngagementPattern[]> {
    try {
      const supabase = await createClient()

      const { data: performances } = await supabase
        .from('content_performance')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20)

      const patterns: EngagementPattern[] = []

      if (performances && performances.length > 0) {
        // Group by content type
        const byType = performances.reduce((acc, p) => {
          const type = p.content_type || 'unknown'
          if (!acc[type]) acc[type] = []
          acc[type].push(p)
          return acc
        }, {} as Record<string, any[]>)

        for (const [contentType, items] of Object.entries(byType)) {
          const typedItems = items as any[]
          const avgEngagement = typedItems.reduce((sum: number, p: any) => sum + (p.engagement_score || 0), 0) / typedItems.length
          const avgReadTime = typedItems.reduce((sum: number, p: any) => sum + (p.performance_metrics?.engagementTime || 0), 0) / typedItems.length
          const clickThroughRate = typedItems.filter((p: any) => p.clicked_at).length / typedItems.length
          const conversionRate = typedItems.filter((p: any) => p.converted_at).length / typedItems.length

          patterns.push({
            contentType,
            engagementRate: avgEngagement,
            avgReadTime,
            clickThroughRate,
            conversionRate,
            lastEngagement: new Date(typedItems[0].created_at),
            frequency: typedItems.length
          })
        }
      }

      return patterns
    } catch (error) {
      logger.error('Error getting engagement patterns', error as Error, { leadId })
      return []
    }
  }

  private async inferContentPreferences(leadId: string, userId: string): Promise<LeadContentPreferences> {
    try {
      // Analyze lead behavior to infer preferences
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

      const { data: activities } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20)

      // Infer preferences based on lead data and activities
      let preferredComplexity: 'basic' | 'intermediate' | 'advanced' = 'intermediate'
      let preferredTone: 'formal' | 'casual' | 'professional' | 'friendly' = 'professional'
      const preferredLength: 'short' | 'medium' | 'long' = 'medium'

      if (lead) {
        // Infer complexity based on job title and company
        if (lead.job_title?.toLowerCase().includes('senior') || lead.job_title?.toLowerCase().includes('lead')) {
          preferredComplexity = 'advanced'
        } else if (lead.job_title?.toLowerCase().includes('junior') || lead.job_title?.toLowerCase().includes('associate')) {
          preferredComplexity = 'basic'
        }

        // Infer tone based on industry
        if (lead.company?.toLowerCase().includes('startup') || lead.company?.toLowerCase().includes('tech')) {
          preferredTone = 'casual'
        }
      }

      return {
        preferredComplexity,
        preferredTone,
        preferredLength,
        preferredFormat: 'text',
        preferredChannels: ['email'],
        contentTopics: [],
        engagementPatterns: await this.getEngagementPatterns(leadId, userId)
      }
    } catch (error) {
      logger.error('Error inferring content preferences', error as Error, { leadId })
      return this.getDefaultPreferences()
    }
  }

  private getDefaultPreferences(): LeadContentPreferences {
    return {
      preferredComplexity: 'intermediate',
      preferredTone: 'professional',
      preferredLength: 'medium',
      preferredFormat: 'text',
      preferredChannels: ['email'],
      contentTopics: [],
      engagementPatterns: []
    }
  }

  private async getLeadProfile(leadId: string, userId: string): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      return lead
    } catch (error) {
      logger.error('Error getting lead profile', error as Error, { leadId })
      return null
    }
  }

  private async getRelevantTemplates(
    contentType: string,
    context: Record<string, any>,
    userId: string
  ): Promise<ContentTemplate[]> {
    try {
      const templates = await this.getContentTemplates(contentType, context, userId)

      // Filter templates based on context
      const relevant = templates.filter(template => {
        const metadata = template.metadata

        // Match category
        if (context.category && metadata.category !== context.category) {
          return false
        }

        // Match topic
        if (context.topic && metadata.topic !== context.topic) {
          return false
        }

        // Match target audience
        if (context.targetAudience && metadata.targetAudience !== context.targetAudience) {
          return false
        }

        return true
      })

      return relevant
    } catch (error) {
      logger.error('Error getting relevant templates', error as Error, { contentType, userId })
      return []
    }
  }

  private async selectOptimalTemplate(
    templates: ContentTemplate[],
    preferences: LeadContentPreferences,
    profile: any,
    context: Record<string, any>
  ): Promise<ContentTemplate> {
    if (templates.length === 0) {
      throw new Error('No templates available')
    }

    if (templates.length === 1) {
      return templates[0]
    }

    // Score templates based on preferences and profile
    const scoredTemplates = templates.map(template => {
      let score = 0

      // Match complexity
      if (template.metadata.complexity === preferences.preferredComplexity) {
        score += 30
      }

      // Match tone
      if (template.metadata.tone === preferences.preferredTone) {
        score += 25
      }

      // Match length
      if (template.metadata.length === preferences.preferredLength) {
        score += 20
      }

      // Match format
      if (template.metadata.format === preferences.preferredFormat) {
        score += 15
      }

      // Match topic relevance
      if (context.topic && template.metadata.topic === context.topic) {
        score += 10
      }

      return { template, score }
    })

    // Sort by score and return highest
    scoredTemplates.sort((a, b) => b.score - a.score)
    return scoredTemplates[0].template
  }

  private async generateAdaptationStrategy(
    baseContent: ContentTemplate,
    preferences: LeadContentPreferences,
    performance: ContentPerformance[],
    context: Record<string, any>,
    userId: string
  ): Promise<ContentAdaptationStrategy[]> {
    const adaptations: ContentAdaptationStrategy[] = []

    try {
      // Analyze what needs to be adapted
      const analysis = await this.analyzeAdaptationNeeds(
        baseContent,
        preferences,
        performance,
        context
      )

      for (const need of analysis.needs) {
        const adaptation = await this.generateSpecificAdaptation(
          baseContent,
          need,
          preferences,
          performance,
          context
        )

        if (adaptation) {
          adaptations.push(adaptation)
        }
      }

      return adaptations
    } catch (error) {
      logger.error('Error generating adaptation strategy', error as Error, {
        contentId: baseContent.id,
        userId
      })
      return adaptations
    }
  }

  private async analyzeAdaptationNeeds(
    baseContent: ContentTemplate,
    preferences: LeadContentPreferences,
    performance: ContentPerformance[],
    context: Record<string, any>
  ): Promise<any> {
    // Use AI to analyze what needs to be adapted
    const prompt = `
      Analyze content adaptation needs:

      Base Content: ${JSON.stringify(baseContent)}
      Lead Preferences: ${JSON.stringify(preferences)}
      Recent Performance: ${JSON.stringify(performance.slice(0, 5))}
      Context: ${JSON.stringify(context)}

      Identify what needs to be adapted:
      1. Tone adjustments
      2. Complexity changes
      3. Length modifications
      4. Format changes
      5. Content additions/removals

      Return JSON with adaptation needs and reasoning.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async generateSpecificAdaptation(
    baseContent: ContentTemplate,
    need: any,
    preferences: LeadContentPreferences,
    performance: ContentPerformance[],
    context: Record<string, any>
  ): Promise<ContentAdaptationStrategy | null> {
    // Generate specific adaptation based on need
    const prompt = `
      Generate specific content adaptation:

      Content: ${baseContent.body}
      Adaptation Need: ${JSON.stringify(need)}
      Preferences: ${JSON.stringify(preferences)}
      Context: ${JSON.stringify(context)}

      Provide the adapted content and explain the reasoning.
      Return JSON format.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    })

    const adaptation = JSON.parse(response.choices[0].message.content)

    if (adaptation.adaptedContent) {
      return {
        id: crypto.randomUUID(),
        leadId: context.leadId || '',
        strategyType: need.type,
        originalValue: baseContent.body,
        adaptedValue: adaptation.adaptedContent,
        adaptationReason: adaptation.reasoning,
        confidenceScore: adaptation.confidence || 0.8,
        appliedAt: new Date(),
        createdAt: new Date()
      }
    }

    return null
  }

  private async applyAdaptationStrategy(
    baseContent: ContentTemplate,
    adaptations: ContentAdaptationStrategy[],
    userId: string
  ): Promise<ContentTemplate> {
    const adaptedContent = { ...baseContent }

    for (const adaptation of adaptations) {
      // Apply each adaptation
      switch (adaptation.strategyType) {
        case 'tone':
          adaptedContent.body = adaptation.adaptedValue
          adaptedContent.metadata.tone = this.extractTone(adaptation.adaptedValue)
          break
        case 'complexity':
          adaptedContent.body = adaptation.adaptedValue
          adaptedContent.metadata.complexity = this.extractComplexity(adaptation.adaptedValue)
          break
        case 'length':
          adaptedContent.body = adaptation.adaptedValue
          adaptedContent.metadata.length = this.extractLength(adaptation.adaptedValue)
          break
        case 'format':
          adaptedContent.body = adaptation.adaptedValue
          adaptedContent.metadata.format = this.extractFormat(adaptation.adaptedValue)
          break
        default:
          adaptedContent.body = adaptation.adaptedValue
      }

      // Add to adaptation history
      adaptedContent.adaptationHistory.push(adaptation)
    }

    return adaptedContent
  }

  private extractTone(content: string): 'formal' | 'casual' | 'professional' | 'friendly' {
    // Simple tone analysis - in production would use NLP
    if (content.includes('!') || content.includes('Hey') || content.includes('you know')) {
      return 'casual'
    } else if (content.includes('Dear') || content.includes('Sincerely')) {
      return 'formal'
    } else if (content.includes('professional') || content.includes('expertise')) {
      return 'professional'
    }
    return 'friendly'
  }

  private extractComplexity(content: string): 'basic' | 'intermediate' | 'advanced' {
    const words = content.split(' ').length
    const sentences = content.split('.').length

    if (words < 50 || sentences < 3) {
      return 'basic'
    } else if (words < 150 || sentences < 8) {
      return 'intermediate'
    }
    return 'advanced'
  }

  private extractLength(content: string): 'short' | 'medium' | 'long' {
    const words = content.split(' ').length

    if (words < 50) {
      return 'short'
    } else if (words < 150) {
      return 'medium'
    }
    return 'long'
  }

  private extractFormat(content: string): 'text' | 'html' | 'markdown' {
    if (content.includes('<') && content.includes('>')) {
      return 'html'
    } else if (content.includes('#') || content.includes('**')) {
      return 'markdown'
    }
    return 'text'
  }

  private async storeAdaptationStrategy(
    leadId: string,
    adaptations: ContentAdaptationStrategy[],
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      for (const adaptation of adaptations) {
        await supabase
          .from('content_adaptation_strategies')
          .insert({
            lead_id: leadId,
            strategy_type: adaptation.strategyType,
            original_value: adaptation.originalValue,
            adapted_value: adaptation.adaptedValue,
            adaptation_reason: adaptation.adaptationReason,
            confidence_score: adaptation.confidenceScore,
            applied_at: adaptation.appliedAt,
            created_at: adaptation.createdAt
          })
      }

      // Update cache
      const leadStrategies = this.adaptationStrategies.get(leadId) || []
      leadStrategies.push(...adaptations)
      this.adaptationStrategies.set(leadId, leadStrategies)
    } catch (error) {
      logger.error('Error storing adaptation strategy', error as Error, { leadId })
    }
  }

  private async generateOptimizationRecommendations(
    leadId: string,
    performance: ContentPerformance[],
    userId: string
  ): Promise<any[]> {
    // Generate optimization recommendations based on performance
    const prompt = `
      Analyze content performance and generate optimization recommendations:

      Performance Data: ${JSON.stringify(performance)}
      Lead ID: ${leadId}

      Identify:
      1. Best performing content types
      2. Optimal timing patterns
      3. Content preferences
      4. Areas for improvement

      Return JSON with recommendations.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async applyOptimizations(
    leadId: string,
    optimizations: any[],
    userId: string
  ): Promise<void> {
    try {
      // Apply optimization recommendations
      for (const optimization of optimizations) {
        await this.applySingleOptimization(leadId, optimization, userId)
      }
    } catch (error) {
      logger.error('Error applying optimizations', error as Error, { leadId })
    }
  }

  private async applySingleOptimization(
    leadId: string,
    optimization: any,
    userId: string
  ): Promise<void> {
    // Apply individual optimization
    try {
      const supabase = await createClient()

      await supabase
        .from('lead_preferences')
        .upsert({
          lead_id: leadId,
          preferred_complexity: optimization.preferredComplexity,
          preferred_tone: optimization.preferredTone,
          preferred_length: optimization.preferredLength,
          preferred_channels: optimization.preferredChannels,
          content_topics: optimization.contentTopics,
          updated_at: new Date()
        })
    } catch (error) {
      logger.error('Error applying single optimization', error as Error, { leadId, optimization: optimization.type })
    }
  }
}

export const contentAdaptationEngine = ContentAdaptationEngine.getInstance()