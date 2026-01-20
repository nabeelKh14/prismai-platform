/**
 * Dynamic Personalization Engine
 * Core engine for automated nurturing sequences with behavioral triggers and real-time content adaptation
 */

import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/lib/ai/gemini-client'
import { leadGenerationService } from '@/lib/lead-generation/lead-generation-service'
import { logger } from '@/lib/logger'

export interface PersonalizationConfig {
  enableBehavioralTriggers: boolean
  enableRealTimeAdaptation: boolean
  enableDynamicSequences: boolean
  enableHumanLikeEngagement: boolean
  enableAutomatedOptimization: boolean
  minEngagementScore: number
  highQualityThreshold: number
  optimizationInterval: number // minutes
}

export interface LeadProfile {
  id: string
  email: string
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  leadScore: number
  engagementScore: number
  behaviorPatterns: BehaviorPattern[]
  preferences: LeadPreferences
  journeyStage: JourneyStage
  lastInteraction: Date
  communicationChannel: CommunicationChannel
}

export interface BehaviorPattern {
  type: 'engagement' | 'content_interaction' | 'timing' | 'channel_preference'
  pattern: string
  confidence: number
  frequency: number
  lastObserved: Date
}

export interface LeadPreferences {
  contentTypes: string[]
  communicationChannels: CommunicationChannel[]
  preferredTimes: TimeSlot[]
  topics: string[]
  tone: 'formal' | 'casual' | 'professional'
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
}

export interface JourneyStage {
  current: 'awareness' | 'consideration' | 'decision' | 'retention' | 'advocacy'
  confidence: number
  nextActions: string[]
  blockers: string[]
}

export interface CommunicationChannel {
  type: 'email' | 'sms' | 'whatsapp' | 'chat' | 'phone'
  preference: number // 0-1 scale
  effectiveness: number // 0-1 scale
  lastUsed: Date
}

export interface TimeSlot {
  dayOfWeek: number // 0-6, Sunday = 0
  hour: number // 0-23
  timezone: string
}

export interface NurturingSequence {
  id: string
  leadId: string
  name: string
  description: string
  stages: SequenceStage[]
  currentStage: number
  status: 'active' | 'paused' | 'completed' | 'archived'
  createdAt: Date
  updatedAt: Date
  performance: SequencePerformance
}

export interface SequenceStage {
  id: string
  name: string
  type: 'content' | 'action' | 'wait' | 'decision'
  content?: ContentTemplate
  action?: ActionTemplate
  waitTime?: number // minutes
  conditions?: StageCondition[]
  nextStageIds: string[]
}

export interface ContentTemplate {
  type: 'email' | 'sms' | 'whatsapp' | 'chat_message'
  subject?: string
  body: string
  variables: Record<string, string>
  attachments?: string[]
  personalizationTags: string[]
}

  parameters: Record<string, unknown>
export interface ActionTemplate {
  type: 'send_message' | 'schedule_call' | 'create_task' | 'update_lead' | 'trigger_workflow'
  parameters: Record<string, any>
}

export interface StageCondition {
  type: 'time_elapsed' | 'engagement_score' | 'lead_score' | 'behavior_pattern' | 'custom'
  value: unknown
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains'
  value: any
}

export interface SequencePerformance {
  totalSent: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  totalConverted: number
  avgEngagementTime: number
  bounceRate: number
  unsubscribeRate: number
}

export class PersonalizationEngine {
  private static instance: PersonalizationEngine
  private config: PersonalizationConfig
  private activeSequences: Map<string, NurturingSequence> = new Map()
  private leadProfiles: Map<string, LeadProfile> = new Map()

  /**
   * PRIVACY BY DESIGN: Personalization engine defaults prioritize user privacy
   * All tracking and personalization features are disabled by default to implement:
   * - Data Minimization: Only collect data when explicitly enabled
   * - Purpose Limitation: Features only activate with user consent
   * - Privacy by Default: Conservative defaults prevent unauthorized data processing
   * Users must explicitly opt-in to enable personalization features.
   */
  constructor() {
    this.config = {
      enableBehavioralTriggers: false, // PRIVACY: Default to false to prevent behavioral tracking without consent
      enableRealTimeAdaptation: false, // PRIVACY: Default to false to prevent real-time content adaptation without consent
      enableDynamicSequences: false, // PRIVACY: Default to false to prevent dynamic personalization without consent
      enableHumanLikeEngagement: false, // PRIVACY: Default to false to prevent automated engagement without consent
      enableAutomatedOptimization: false, // PRIVACY: Default to false to prevent automated optimization without consent
      minEngagementScore: 30,
      highQualityThreshold: 80,
      optimizationInterval: 60
    }
  }

  static getInstance(): PersonalizationEngine {
    if (!PersonalizationEngine.instance) {
      PersonalizationEngine.instance = new PersonalizationEngine()
    }
    return PersonalizationEngine.instance
  }

  /**
   * Initialize personalization engine for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      logger.info('Initializing personalization engine', { userId })

      // Load existing sequences
      await this.loadActiveSequences(userId)

      // Load lead profiles
      await this.loadLeadProfiles(userId)

      // Start optimization cycle
      if (this.config.enableAutomatedOptimization) {
        this.startOptimizationCycle(userId)
      }

      logger.info('Personalization engine initialized successfully', { userId })
    } catch (error) {
      logger.error('Error initializing personalization engine', error as Error, { userId })
      throw error
    }
  }

  /**
   * Process lead behavior and trigger personalization actions
   */
  async processLeadBehavior(
    behaviorData: Record<string, unknown>,
    leadId: string,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      // Update lead profile
      const profile = await this.updateLeadProfile(leadId, behaviorType, behaviorData, userId)

      // Check behavioral triggers
      if (this.config.enableBehavioralTriggers) {
        await this.checkBehavioralTriggers(leadId, behaviorType, behaviorData, userId)
      }

      // Adapt content in real-time
      if (this.config.enableRealTimeAdaptation) {
        await this.adaptContentRealTime(profile, behaviorType, behaviorData, userId)
      }

      // Update nurturing sequences
      if (this.config.enableDynamicSequences) {
        await this.updateNurturingSequences(leadId, profile, userId)
      }

    } catch (error) {
      logger.error('Error processing lead behavior', error as Error, { leadId, behaviorType })
    }
  }

  /**
   * Create personalized nurturing sequence for a lead
   */
  async createPersonalizedSequence(
    leadId: string,
    userId: string,
    options: {
      name?: string
      description?: string
      template?: string
      priority?: 'high' | 'medium' | 'low'
    } = {}
  ): Promise<NurturingSequence> {
    try {
      const profile = await this.getLeadProfile(leadId, userId)

      // Generate personalized sequence based on lead profile
      const sequence = await this.generateOptimalSequence(profile, options, userId)

      // Store sequence
      await this.saveSequence(sequence, userId)

      // Start sequence
      await this.startSequence(sequence.id, userId)

      logger.info('Created personalized nurturing sequence', {
        leadId,
        sequenceId: sequence.id,
        userId
      })

      return sequence
    } catch (error) {
      logger.error('Error creating personalized sequence', error as Error, { leadId, userId })
      throw error
    }
  }

  /**
   * Get personalized content for a lead
   */
  async getPersonalizedContent(
    leadId: string,
    contentType: 'email' | 'sms' | 'whatsapp' | 'chat',
    context: Record<string, any>,
    userId: string
  ): Promise<ContentTemplate> {
    try {
      const profile = await this.getLeadProfile(leadId, userId)

      // Generate personalized content based on profile and context
      const content = await this.generatePersonalizedContent(
        profile,
        contentType as 'email' | 'sms' | 'whatsapp' | 'chat',
        context,
        userId
      )

      return content
    } catch (error) {
      logger.error('Error generating personalized content', error as Error, { leadId, contentType })
      throw error
    }
  }

  /**
   * Optimize nurturing sequences based on performance
   */
  async optimizeSequences(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Get all active sequences
      const { data: sequences } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')

      for (const sequence of sequences || []) {
        // Analyze performance
        const performance = await this.analyzeSequencePerformance(sequence.id, userId)

        // Optimize based on performance
        if (performance.needsOptimization) {
          await this.optimizeSequence(sequence.id, performance, userId)
        }
      }

      logger.info('Sequence optimization completed', { userId })
    } catch (error) {
      logger.error('Error optimizing sequences', error as Error, { userId })
    }
  }

  // Private helper methods

  private async loadActiveSequences(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: sequences } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')

      for (const sequence of sequences || []) {
        this.activeSequences.set(sequence.id, sequence as NurturingSequence)
      }

      logger.info('Loaded active sequences', {
        count: sequences?.length || 0,
        userId
      })
    } catch (error) {
      logger.error('Error loading active sequences', error as Error, { userId })
    }
  }

  private async loadLeadProfiles(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1000)

      for (const lead of leads || []) {
        const profile = await this.buildLeadProfile(lead, userId)
        this.leadProfiles.set(lead.id, profile)
      }

      logger.info('Loaded lead profiles', {
        count: leads?.length || 0,
        userId
      })
    } catch (error) {
      logger.error('Error loading lead profiles', error as Error, { userId })
    }
  }

    behaviorData: Record<string, unknown>,
  private async updateLeadProfile(
    leadId: string,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<LeadProfile> {
    try {
      const supabase = await createClient()

      // Get current lead data
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead) {
        throw new Error('Lead not found')
      }

      // Update behavior patterns
      const behaviorPattern = await this.analyzeBehaviorPattern(behaviorType, behaviorData)

      // Update lead profile
      const updatedProfile = await this.buildLeadProfile(lead, userId)
      updatedProfile.behaviorPatterns.push(behaviorPattern)

      // Store updated profile
      this.leadProfiles.set(leadId, updatedProfile)

      // Persist behavior data
      await supabase
        .from('lead_behavior_patterns')
        .insert({
          lead_id: leadId,
          behavior_type: behaviorType,
          behavior_data: behaviorData,
          pattern_analysis: behaviorPattern,
          created_at: new Date()
        })

      return updatedProfile
    } catch (error) {
      logger.error('Error updating lead profile', error as Error, { leadId })
      throw error
    }
  }

  private async checkBehavioralTriggers(
    leadId: string,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      // Get active behavioral triggers
      const { data: triggers } = await supabase
        .from('behavioral_triggers')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      for (const trigger of triggers || []) {
        if (await this.evaluateTrigger(trigger, leadId, behaviorType, behaviorData)) {
          await this.executeTriggerAction(trigger, leadId, userId)
        }
      }
    } catch (error) {
      logger.error('Error checking behavioral triggers', error as Error, { leadId })
    }
  }

  private async adaptContentRealTime(
    profile: LeadProfile,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      // Analyze recent behavior to adapt content strategy
      const adaptation = await this.analyzeContentAdaptation(profile, behaviorType, behaviorData)

      if (adaptation.needsAdaptation) {
        // Update content strategy
        await this.updateContentStrategy(profile.id, adaptation, userId)
      }
    } catch (error) {
      logger.error('Error adapting content in real-time', error as Error, { leadId: profile.id })
    }
  }

  private async updateNurturingSequences(
    leadId: string,
    profile: LeadProfile,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      // Get active sequences for this lead
      const { data: sequences } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'active')

      for (const sequence of sequences || []) {
        // Update sequence based on lead profile changes
        await this.adaptSequenceToProfile(sequence.id, profile, userId)
      }
    } catch (error) {
      logger.error('Error updating nurturing sequences', error as Error, { leadId })
    }
  }

  private async generateOptimalSequence(
    profile: LeadProfile,
    options: any,
    userId: string
  ): Promise<NurturingSequence> {
    // Generate optimal sequence based on lead profile using AI
    const prompt = `
      Generate an optimal nurturing sequence for this lead profile:

      Lead Profile:
      - Score: ${profile.leadScore}
      - Engagement: ${profile.engagementScore}
      - Journey Stage: ${profile.journeyStage.current}
      - Preferences: ${JSON.stringify(profile.preferences)}
      - Behavior Patterns: ${JSON.stringify(profile.behaviorPatterns)}

      Create a nurturing sequence with:
      1. Appropriate number of stages (3-7)
      2. Content types matching preferences
      3. Timing based on behavior patterns
      4. Channel preferences
      5. Journey stage appropriate messaging

      Return JSON format with sequence structure.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    const sequenceData = JSON.parse(response.choices[0].message.content)

    return {
      id: crypto.randomUUID(),
      leadId: profile.id,
      name: options.name || `Personalized Sequence - ${profile.firstName || profile.email}`,
      description: options.description || 'AI-generated personalized nurturing sequence',
      stages: sequenceData.stages,
      currentStage: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      performance: {
        totalSent: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalReplied: 0,
        totalConverted: 0,
        avgEngagementTime: 0,
        bounceRate: 0,
        unsubscribeRate: 0
      }
    }
  }

  private async generatePersonalizedContent(
    profile: LeadProfile,
    contentType: string,
    context: Record<string, any>,
    userId: string
  ): Promise<ContentTemplate> {
    // Generate personalized content using AI
    const prompt = `
      Generate personalized ${contentType} content for this lead:

      Lead Profile:
      - Name: ${profile.firstName} ${profile.lastName}
      - Company: ${profile.company}
      - Journey Stage: ${profile.journeyStage.current}
      - Preferences: ${JSON.stringify(profile.preferences)}
      - Recent Behavior: ${JSON.stringify(profile.behaviorPatterns.slice(-3))}

      Context: ${JSON.stringify(context)}

      Create content that:
      1. Matches their communication preferences
      2. Aligns with their journey stage
      3. Reflects their tone preference
      4. Includes relevant personalization variables

      Return JSON format with subject, body, and variables.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })

    const contentData = JSON.parse(response.choices[0].message.content)

    return {
      type: contentType as 'email' | 'sms' | 'whatsapp' | 'chat_message',
      subject: contentData.subject,
      body: contentData.body,
      variables: contentData.variables,
      personalizationTags: contentData.personalizationTags || []
    }
  }

  private async analyzeBehaviorPattern(
    behaviorType: string,
    behaviorData: Record<string, any>
  ): Promise<BehaviorPattern> {
    // Analyze behavior pattern using AI
    const prompt = `
      Analyze this behavior pattern:

      Type: ${behaviorType}
      Data: ${JSON.stringify(behaviorData)}

      Identify:
      1. Pattern type (engagement, content_interaction, timing, channel_preference)
      2. Pattern description
      3. Confidence level (0-1)
      4. Frequency indication

      Return JSON format.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    const analysis = JSON.parse(response.choices[0].message.content)

    return {
      type: analysis.type,
      pattern: analysis.pattern,
      confidence: analysis.confidence,
      frequency: analysis.frequency,
      lastObserved: new Date()
    }
  }

  private async buildLeadProfile(lead: any, userId: string): Promise<LeadProfile> {
    // Build comprehensive lead profile from database data
    const behaviorPatterns = await this.getLeadBehaviorPatterns(lead.id, userId)
    const preferences = await this.inferLeadPreferences(lead.id, userId)
    const journeyStage = await this.determineJourneyStage(lead.id, userId)

    return {
      id: lead.id,
      email: lead.email,
      firstName: lead.first_name,
      lastName: lead.last_name,
      company: lead.company,
      jobTitle: lead.job_title,
      leadScore: lead.lead_score || 0,
      engagementScore: lead.engagement_score || 0,
      behaviorPatterns,
      preferences,
      journeyStage,
      lastInteraction: new Date(lead.updated_at),
      communicationChannel: await this.getPreferredChannel(lead.id, userId)
    }
  }

  private async getLeadBehaviorPatterns(leadId: string, userId: string): Promise<BehaviorPattern[]> {
    try {
      const supabase = await createClient()

      const { data: patterns } = await supabase
        .from('lead_behavior_patterns')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10)

      return patterns?.map(p => p.pattern_analysis) || []
    } catch (error) {
      logger.error('Error getting behavior patterns', error as Error, { leadId })
      return []
    }
  }

  private async inferLeadPreferences(leadId: string, userId: string): Promise<LeadPreferences> {
    // Infer preferences from behavior and engagement data
    try {
      const supabase = await createClient()

      const { data: engagement } = await supabase
        .from('lead_engagement')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(50)

      // Analyze engagement patterns to infer preferences
      const preferences: LeadPreferences = {
        contentTypes: [],
        communicationChannels: [],
        preferredTimes: [],
        topics: [],
        tone: 'professional',
        frequency: 'weekly'
      }

      if (engagement && engagement.length > 0) {
        // Analyze channel preferences
        const channelCounts = engagement.reduce((acc, e) => {
          acc[e.channel] = (acc[e.channel] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        preferences.communicationChannels = Object.entries(channelCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([channel, count]) => ({
            type: channel as any,
            preference: (count as number) / engagement.length,
            effectiveness: 0.5, // Would be calculated from response rates
            lastUsed: new Date(engagement.find(e => e.channel === channel)?.created_at || '')
          }))

        // Analyze timing preferences
        const hourCounts = engagement.reduce((acc, e) => {
          const hour = new Date(e.created_at).getHours()
          acc[hour] = (acc[hour] || 0) + 1
          return acc
        }, {} as Record<number, number>)

        preferences.preferredTimes = Object.entries(hourCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([hour]) => ({
            dayOfWeek: 0, // Would be calculated properly
            hour: parseInt(hour),
            timezone: 'UTC' // Would be inferred from activity
          }))
      }

      return preferences
    } catch (error) {
      logger.error('Error inferring lead preferences', error as Error, { leadId })
      return {
        contentTypes: ['educational'],
        communicationChannels: [{ type: 'email', preference: 1, effectiveness: 0.5, lastUsed: new Date() }],
        preferredTimes: [{ dayOfWeek: 1, hour: 9, timezone: 'UTC' }],
        topics: [],
        tone: 'professional',
        frequency: 'weekly'
      }
    }
  }

  private async determineJourneyStage(leadId: string, userId: string): Promise<JourneyStage> {
    try {
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

      // Analyze activities to determine journey stage
      let stage = 'awareness'
      let confidence = 0.5
      const nextActions: string[] = []
      const blockers: string[] = []

      if (activities && activities.length > 0) {
        const activityTypes = activities.map(a => a.type)

        if (activityTypes.includes('demo_requested') || activityTypes.includes('meeting_booked')) {
          stage = 'decision'
          confidence = 0.8
          nextActions.push('Follow up on demo/meeting')
        } else if (activityTypes.includes('content_downloaded') || activityTypes.includes('webinar_attended')) {
          stage = 'consideration'
          confidence = 0.7
          nextActions.push('Send case studies', 'Offer consultation')
        } else if (activityTypes.includes('email_opened') || activityTypes.includes('website_visit')) {
          stage = 'awareness'
          confidence = 0.6
          nextActions.push('Send educational content', 'Invite to webinar')
        }

        // Check for potential blockers
        if (activities.filter(a => a.type === 'unsubscribe' || a.type === 'complaint').length > 0) {
          blockers.push('Previous negative experience')
        }
      }

      return {
        current: stage as any,
        confidence,
        nextActions,
        blockers
      }
    } catch (error) {
      logger.error('Error determining journey stage', error as Error, { leadId })
      return {
        current: 'awareness',
        confidence: 0.5,
        nextActions: ['Send welcome content'],
        blockers: []
      }
    }
  }

  private async getPreferredChannel(leadId: string, userId: string): Promise<CommunicationChannel> {
    try {
      const supabase = await createClient()

      const { data: engagement } = await supabase
        .from('lead_engagement')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (engagement && engagement.length > 0) {
        const channelCounts = engagement.reduce((acc, e) => {
          acc[e.channel] = (acc[e.channel] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        const preferredChannel = Object.entries(channelCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))[0]

        return {
          type: preferredChannel[0] as any,
          preference: (preferredChannel[1] as number) / engagement.length,
          effectiveness: 0.5, // Would be calculated from response rates
          lastUsed: new Date(engagement[0].created_at)
        }
      }

      return {
        type: 'email',
        preference: 1,
        effectiveness: 0.5,
        lastUsed: new Date()
      }
    } catch (error) {
      logger.error('Error getting preferred channel', error as Error, { leadId })
      return {
        type: 'email',
        preference: 1,
        effectiveness: 0.5,
        lastUsed: new Date()
      }
    }
  }

  private async evaluateTrigger(trigger: any, leadId: string, behaviorType: string, behaviorData: Record<string, any>): Promise<boolean> {
    // Evaluate if trigger conditions are met
    const conditions = trigger.conditions

    for (const condition of conditions) {
      switch (condition.type) {
        case 'behavior_type':
          if (condition.value !== behaviorType) return false
          break
        case 'lead_score':
          const profile = this.leadProfiles.get(leadId)
          if (!profile || !this.evaluateCondition(profile.leadScore, condition.operator, condition.value)) {
            return false
          }
          break
        // Add more condition types as needed
      }
    }

    return true
  }

  private async executeTriggerAction(trigger: any, leadId: string, userId: string): Promise<void> {
    // Execute trigger actions
    for (const action of trigger.actions) {
      switch (action.type) {
        case 'send_message':
          await this.sendTriggeredMessage(leadId, action, userId)
          break
        case 'update_sequence':
          await this.updateSequenceFromTrigger(leadId, action, userId)
          break
        case 'create_task':
          await this.createTriggeredTask(leadId, action, userId)
          break
      }
    }
  }

  private evaluateCondition(value: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return value === expected
      case 'greater_than':
        return value > expected
      case 'less_than':
        return value < expected
      case 'contains':
        return String(value).includes(String(expected))
      case 'not_contains':
        return !String(value).includes(String(expected))
      default:
        return false
    }
  }

  private async analyzeContentAdaptation(
    profile: LeadProfile,
    behaviorType: string,
    behaviorData: Record<string, any>
  ): Promise<any> {
    // Analyze if content strategy needs adaptation
    const prompt = `
      Analyze if content strategy needs adaptation based on:

      Lead Profile: ${JSON.stringify(profile)}
      Recent Behavior: ${behaviorType} - ${JSON.stringify(behaviorData)}

      Determine:
      1. If adaptation is needed
      2. What type of adaptation
      3. Confidence level
      4. Recommended changes

      Return JSON format.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async updateContentStrategy(leadId: string, adaptation: any, userId: string): Promise<void> {
    // Update content strategy based on adaptation analysis
    try {
      const supabase = await createClient()

      await supabase
        .from('lead_content_strategies')
        .upsert({
          lead_id: leadId,
          adaptation_data: adaptation,
          updated_at: new Date()
        })
    } catch (error) {
      logger.error('Error updating content strategy', error as Error, { leadId })
    }
  }

  private async adaptSequenceToProfile(sequenceId: string, profile: LeadProfile, userId: string): Promise<void> {
    // Adapt sequence stages based on updated profile
    try {
      const supabase = await createClient()

      // Get current sequence
      const { data: sequence } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('id', sequenceId)
        .single()

      if (!sequence) return

      // Adapt sequence based on profile changes
      const adaptedStages = await this.adaptSequenceStages(sequence.stages, profile)

      await supabase
        .from('nurturing_sequences')
        .update({
          stages: adaptedStages,
          updated_at: new Date()
        })
        .eq('id', sequenceId)
    } catch (error) {
      logger.error('Error adapting sequence to profile', error as Error, { sequenceId })
    }
  }

  private async adaptSequenceStages(stages: any[], profile: LeadProfile): Promise<any[]> {
    // Adapt sequence stages based on lead profile
    const prompt = `
      Adapt these sequence stages for the updated lead profile:

      Current Stages: ${JSON.stringify(stages)}
      Lead Profile: ${JSON.stringify(profile)}

      Adapt:
      1. Content to match preferences
      2. Timing based on behavior patterns
      3. Channel preferences
      4. Journey stage alignment

      Return adapted stages in JSON format.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async saveSequence(sequence: NurturingSequence, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('nurturing_sequences')
        .insert({
          id: sequence.id,
          lead_id: sequence.leadId,
          user_id: userId,
          name: sequence.name,
          description: sequence.description,
          stages: sequence.stages,
          current_stage: sequence.currentStage,
          status: sequence.status,
          performance: sequence.performance,
          created_at: sequence.createdAt,
          updated_at: sequence.updatedAt
        })

      this.activeSequences.set(sequence.id, sequence)
    } catch (error) {
      logger.error('Error saving sequence', error as Error, { sequenceId: sequence.id })
    }
  }

  private async startSequence(sequenceId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Update sequence status to active
      await supabase
        .from('nurturing_sequences')
        .update({ status: 'active' })
        .eq('id', sequenceId)

      // Start first stage
      await this.executeSequenceStage(sequenceId, 0, userId)
    } catch (error) {
      logger.error('Error starting sequence', error as Error, { sequenceId })
    }
  }

  private async executeSequenceStage(sequenceId: string, stageIndex: number, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: sequence } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('id', sequenceId)
        .single()

      if (!sequence || stageIndex >= sequence.stages.length) return

      const stage = sequence.stages[stageIndex]

      // Execute stage based on type
      switch (stage.type) {
        case 'content':
          await this.executeContentStage(sequenceId, stage, userId)
          break
        case 'action':
          await this.executeActionStage(sequenceId, stage, userId)
          break
        case 'wait':
          await this.scheduleNextStage(sequenceId, stageIndex, stage.waitTime || 0, userId)
          break
        case 'decision':
          await this.evaluateDecisionStage(sequenceId, stage, stageIndex, userId)
          break
      }
    } catch (error) {
      logger.error('Error executing sequence stage', error as Error, { sequenceId, stageIndex })
    }
  }

  private async executeContentStage(sequenceId: string, stage: any, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: sequence } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('id', sequenceId)
        .single()

      if (!sequence) return

      // Get lead profile for personalization
      const profile = await this.getLeadProfile(sequence.lead_id, userId)

      // Generate personalized content
      const content = await this.generatePersonalizedContent(
        profile,
        stage.content.type,
        { stage: stage.name, sequence: sequence.name },
        userId
      )

      // Send content based on type
      switch (stage.content.type) {
        case 'email':
          await this.sendPersonalizedEmail(sequence.lead_id, content, userId)
          break
        case 'sms':
          await this.sendPersonalizedSMS(sequence.lead_id, content, userId)
          break
        case 'whatsapp':
          await this.sendPersonalizedWhatsApp(sequence.lead_id, content, userId)
          break
        case 'chat_message':
          await this.sendPersonalizedChat(sequence.lead_id, content, userId)
          break
      }

      // Update performance metrics
      await supabase
        .from('nurturing_sequences')
        .update({
          'performance->totalSent': (sequence.performance.totalSent || 0) + 1,
          updated_at: new Date()
        })
        .eq('id', sequenceId)

      // Schedule next stage
      await this.scheduleNextStage(sequenceId, sequence.current_stage, 0, userId)
    } catch (error) {
      logger.error('Error executing content stage', error as Error, { sequenceId })
    }
  }

  private async executeActionStage(sequenceId: string, stage: any, userId: string): Promise<void> {
    try {
      // Execute action based on type
      switch (stage.action.type) {
        case 'create_task':
          await this.createTaskFromStage(sequenceId, stage.action, userId)
          break
        case 'update_lead':
          await this.updateLeadFromStage(sequenceId, stage.action, userId)
          break
        case 'trigger_workflow':
          await this.triggerWorkflowFromStage(sequenceId, stage.action, userId)
          break
      }

      // Schedule next stage
      await this.scheduleNextStage(sequenceId, stage.index, 0, userId)
    } catch (error) {
      logger.error('Error executing action stage', error as Error, { sequenceId })
    }
  }

  private async evaluateDecisionStage(sequenceId: string, stage: any, stageIndex: number, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: sequence } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('id', sequenceId)
        .single()

      if (!sequence) return

      // Evaluate conditions to determine next stage
      const nextStageIndex = stageIndex + 1

      for (const condition of stage.conditions || []) {
        const isMet = await this.evaluateStageCondition(sequence.lead_id, condition, userId)

        if (isMet) {
          // Find the stage ID that matches this condition
          const nextStageId = stage.nextStageIds.find((id: string, index: number) =>
            condition.nextStageIndex === index
          )

          if (nextStageId) {
            const nextStageIndex = sequence.stages.findIndex((s: any) => s.id === nextStageId)
            if (nextStageIndex !== -1) {
              break
            }
          }
        }
      }

      // Schedule next stage
      await this.scheduleNextStage(sequenceId, nextStageIndex, 0, userId)
    } catch (error) {
      logger.error('Error evaluating decision stage', error as Error, { sequenceId })
    }
  }

  private async evaluateStageCondition(leadId: string, condition: StageCondition, userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      switch (condition.type) {
        case 'time_elapsed':
          const { data: sequence } = await supabase
            .from('nurturing_sequences')
            .select('created_at')
            .eq('lead_id', leadId)
            .single()

          if (!sequence) return false

          const elapsed = Date.now() - new Date(sequence.created_at).getTime()
          const elapsedMinutes = elapsed / (1000 * 60)

          return this.evaluateCondition(elapsedMinutes, condition.operator, condition.value)

        case 'engagement_score':
          const { data: lead } = await supabase
            .from('leads')
            .select('engagement_score')
            .eq('id', leadId)
            .single()

          if (!lead) return false

          return this.evaluateCondition(lead.engagement_score || 0, condition.operator, condition.value)

        case 'lead_score':
          const { data: leadData } = await supabase
            .from('leads')
            .select('lead_score')
            .eq('id', leadId)
            .single()

          if (!leadData) return false

          return this.evaluateCondition(leadData.lead_score || 0, condition.operator, condition.value)

        default:
          return false
      }
    } catch (error) {
      logger.error('Error evaluating stage condition', error as Error, { leadId, condition: condition.type })
      return false
    }
  }

  private async scheduleNextStage(sequenceId: string, currentStageIndex: number, delayMinutes: number, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: sequence } = await supabase
        .from('nurturing_sequences')
        .select('*')
        .eq('id', sequenceId)
        .single()

      if (!sequence) return

      const nextStageIndex = currentStageIndex + 1

      if (nextStageIndex >= sequence.stages.length) {
        // Sequence completed
        await supabase
          .from('nurturing_sequences')
          .update({
            status: 'completed',
            current_stage: nextStageIndex,
            updated_at: new Date()
          })
          .eq('id', sequenceId)

        return
      }

      // Update current stage
      await supabase
        .from('nurturing_sequences')
        .update({
          current_stage: nextStageIndex,
          updated_at: new Date()
        })
        .eq('id', sequenceId)

      // Schedule next stage execution
      if (delayMinutes > 0) {
        // In production, this would use a job queue
        setTimeout(() => {
          this.executeSequenceStage(sequenceId, nextStageIndex, userId)
        }, delayMinutes * 60 * 1000)
      } else {
        // Execute immediately
        this.executeSequenceStage(sequenceId, nextStageIndex, userId)
      }
    } catch (error) {
      logger.error('Error scheduling next stage', error as Error, { sequenceId, currentStageIndex })
    }
  }

  private async sendPersonalizedEmail(leadId: string, content: ContentTemplate, userId: string): Promise<void> {
    // Implementation for sending personalized email
    logger.info('Sending personalized email', { leadId, subject: content.subject })
    // Would integrate with email service
  }

  private async sendPersonalizedSMS(leadId: string, content: ContentTemplate, userId: string): Promise<void> {
    // Implementation for sending personalized SMS
    logger.info('Sending personalized SMS', { leadId, body: content.body })
    // Would integrate with SMS service
  }

  private async sendPersonalizedWhatsApp(leadId: string, content: ContentTemplate, userId: string): Promise<void> {
    // Implementation for sending personalized WhatsApp
    logger.info('Sending personalized WhatsApp', { leadId, body: content.body })
    // Would integrate with WhatsApp service
  }

  private async sendPersonalizedChat(leadId: string, content: ContentTemplate, userId: string): Promise<void> {
    // Implementation for sending personalized chat message
    logger.info('Sending personalized chat', { leadId, body: content.body })
    // Would integrate with chat service
  }

  private async createTaskFromStage(sequenceId: string, action: any, userId: string): Promise<void> {
    // Implementation for creating task from stage
    logger.info('Creating task from stage', { sequenceId, action: action.type })
  }

  private async updateLeadFromStage(sequenceId: string, action: any, userId: string): Promise<void> {
    // Implementation for updating lead from stage
    logger.info('Updating lead from stage', { sequenceId, action: action.type })
  }

  private async triggerWorkflowFromStage(sequenceId: string, action: any, userId: string): Promise<void> {
    // Implementation for triggering workflow from stage
    logger.info('Triggering workflow from stage', { sequenceId, action: action.type })
  }

  private async sendTriggeredMessage(leadId: string, action: any, userId: string): Promise<void> {
    // Implementation for sending triggered message
    logger.info('Sending triggered message', { leadId, action: action.type })
  }

  private async updateSequenceFromTrigger(leadId: string, action: any, userId: string): Promise<void> {
    // Implementation for updating sequence from trigger
    logger.info('Updating sequence from trigger', { leadId, action: action.type })
  }

  private async createTriggeredTask(leadId: string, action: any, userId: string): Promise<void> {
    // Implementation for creating triggered task
    logger.info('Creating triggered task', { leadId, action: action.type })
  }

  private async analyzeSequencePerformance(sequenceId: string, userId: string): Promise<any> {
    // Implementation for analyzing sequence performance
    return { needsOptimization: false }
  }

  private async optimizeSequence(sequenceId: string, performance: any, userId: string): Promise<void> {
    // Implementation for optimizing sequence
    logger.info('Optimizing sequence', { sequenceId })
  }

  private startOptimizationCycle(userId: string): void {
    // Start automated optimization cycle
    setInterval(() => {
      this.optimizeSequences(userId)
    }, this.config.optimizationInterval * 60 * 1000)

    logger.info('Started optimization cycle', { userId, interval: this.config.optimizationInterval })
  }

  private async getLeadProfile(leadId: string, userId: string): Promise<LeadProfile> {
    // Get lead profile from cache or database
    let profile = this.leadProfiles.get(leadId)

    if (!profile) {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (lead) {
        profile = await this.buildLeadProfile(lead, userId)
        this.leadProfiles.set(leadId, profile)
      } else {
        throw new Error('Lead not found')
      }
    }

    return profile
  }
}

export const personalizationEngine = PersonalizationEngine.getInstance()