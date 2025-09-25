/**
 * Human-like Engagement System
 * Provides personalized, conversational interactions for high-quality leads
 */

import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export interface HumanLikeEngagementConfig {
  enablePersonalizedResponses: boolean
  enableContextualFollowups: boolean
  enableEmotionalIntelligence: boolean
  enableNaturalLanguage: boolean
  enableRelationshipBuilding: boolean
  highQualityThreshold: number
  responseDelayRange: { min: number; max: number } // seconds
  maxConversationLength: number
  personalityProfiles: Record<string, PersonalityProfile>
}

export interface PersonalityProfile {
  name: string
  description: string
  traits: {
    tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'enthusiastic'
    communicationStyle: 'direct' | 'storytelling' | 'questioning' | 'collaborative'
    pace: 'fast' | 'moderate' | 'slow'
    focus: 'results' | 'relationship' | 'education' | 'consultation'
  }
  languagePatterns: {
    greetings: string[]
    transitions: string[]
    closings: string[]
    empathy: string[]
    enthusiasm: string[]
  }
  responseTemplates: {
    positive: string[]
    neutral: string[]
    concerned: string[]
    excited: string[]
  }
}

export interface ConversationContext {
  leadId: string
  userId: string
  conversationId: string
  currentTopic: string
  conversationHistory: ConversationMessage[]
  leadProfile: LeadProfile
  engagementLevel: number
  sentiment: 'positive' | 'neutral' | 'negative' | 'excited'
  relationshipStage: 'initial' | 'building' | 'established' | 'deep'
  lastInteraction: Date
  preferredChannel: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata: Record<string, any>
  sentiment?: number
  intent?: string
  entities?: string[]
}

export interface LeadProfile {
  id: string
  name: string
  company: string
  role: string
  industry: string
  painPoints: string[]
  goals: string[]
  preferences: {
    communicationStyle: string
    informationDepth: string
    decisionTimeline: string
  }
  personality: {
    type: string
    traits: string[]
    values: string[]
  }
}

export interface EngagementResponse {
  content: string
  confidence: number
  strategy: string
  nextActions: string[]
  metadata: Record<string, any>
}

export class HumanLikeEngagement {
  private static instance: HumanLikeEngagement
  private config: HumanLikeEngagementConfig
  private activeConversations: Map<string, ConversationContext> = new Map()
  private personalityProfiles: Map<string, PersonalityProfile> = new Map()

  constructor() {
    this.config = {
      enablePersonalizedResponses: true,
      enableContextualFollowups: true,
      enableEmotionalIntelligence: true,
      enableNaturalLanguage: true,
      enableRelationshipBuilding: true,
      highQualityThreshold: 80,
      responseDelayRange: { min: 2, max: 8 },
      maxConversationLength: 20,
      personalityProfiles: this.getDefaultPersonalityProfiles()
    }

    this.initializePersonalityProfiles()
  }

  static getInstance(): HumanLikeEngagement {
    if (!HumanLikeEngagement.instance) {
      HumanLikeEngagement.instance = new HumanLikeEngagement()
    }
    return HumanLikeEngagement.instance
  }

  /**
   * Initialize human-like engagement for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      logger.info('Initializing human-like engagement', { userId })

      // Load user-specific personality profiles
      await this.loadPersonalityProfiles(userId)

      logger.info('Human-like engagement initialized', { userId })
    } catch (error) {
      logger.error('Error initializing human-like engagement', error as Error, { userId })
      throw error
    }
  }

  /**
   * Generate human-like response for high-quality lead
   */
  async generateHumanLikeResponse(
    leadId: string,
    userMessage: string,
    context: Record<string, any>,
    userId: string
  ): Promise<EngagementResponse> {
    try {
      // Check if lead qualifies for human-like engagement
      const leadProfile = await this.getLeadProfile(leadId, userId)

      if (!this.isHighQualityLead(leadProfile)) {
        return this.generateStandardResponse(userMessage, context)
      }

      // Get or create conversation context
      const conversationContext = await this.getConversationContext(leadId, userId)

      // Analyze user message
      const messageAnalysis = await this.analyzeUserMessage(userMessage, conversationContext)

      // Select appropriate personality
      const personality = this.selectPersonality(leadProfile, conversationContext)

      // Generate contextual response
      const response = await this.generateContextualResponse(
        userMessage,
        messageAnalysis,
        conversationContext,
        personality,
        userId
      )

      // Update conversation context
      await this.updateConversationContext(conversationContext, userMessage, response, userId)

      // Add human-like delay
      await this.addHumanLikeDelay()

      logger.info('Generated human-like response', {
        leadId,
        responseLength: response.content.length,
        confidence: response.confidence,
        strategy: response.strategy
      })

      return response
    } catch (error) {
      logger.error('Error generating human-like response', error as Error, { leadId })
      return this.generateFallbackResponse(userMessage)
    }
  }

  /**
   * Build relationship with high-quality lead through conversation
   */
  async buildRelationship(
    leadId: string,
    conversationHistory: ConversationMessage[],
    userId: string
  ): Promise<EngagementResponse> {
    try {
      const leadProfile = await this.getLeadProfile(leadId, userId)
      const conversationContext = await this.getConversationContext(leadId, userId)

      // Analyze relationship stage
      const relationshipStage = await this.analyzeRelationshipStage(conversationHistory, leadProfile)

      // Generate relationship-building response
      const response = await this.generateRelationshipBuildingResponse(
        leadProfile,
        conversationContext,
        relationshipStage,
        userId
      )

      return response
    } catch (error) {
      logger.error('Error building relationship', error as Error, { leadId })
      return this.generateFallbackResponse('Let me help you with that.')
    }
  }

  /**
   * Handle emotional context in conversation
   */
  async handleEmotionalContext(
    leadId: string,
    userMessage: string,
    detectedEmotion: string,
    userId: string
  ): Promise<EngagementResponse> {
    try {
      const leadProfile = await this.getLeadProfile(leadId, userId)
      const conversationContext = await this.getConversationContext(leadId, userId)

      // Generate emotionally intelligent response
      const response = await this.generateEmotionallyIntelligentResponse(
        userMessage,
        detectedEmotion,
        leadProfile,
        conversationContext,
        userId
      )

      return response
    } catch (error) {
      logger.error('Error handling emotional context', error as Error, { leadId, detectedEmotion })
      return this.generateFallbackResponse('I understand how you feel.')
    }
  }

  /**
   * Generate contextual follow-up questions
   */
  async generateContextualFollowups(
    leadId: string,
    conversationHistory: ConversationMessage[],
    userId: string
  ): Promise<string[]> {
    try {
      const leadProfile = await this.getLeadProfile(leadId, userId)
      const conversationContext = await this.getConversationContext(leadId, userId)

      // Analyze conversation for follow-up opportunities
      const analysis = await this.analyzeFollowupOpportunities(
        conversationHistory,
        leadProfile,
        conversationContext
      )

      return analysis.suggestedFollowups
    } catch (error) {
      logger.error('Error generating contextual followups', error as Error, { leadId })
      return ['Can you tell me more about that?', 'What are your thoughts on this?']
    }
  }

  /**
   * Adapt communication style based on lead preferences
   */
  async adaptCommunicationStyle(
    leadId: string,
    currentStyle: string,
    userId: string
  ): Promise<string> {
    try {
      const leadProfile = await this.getLeadProfile(leadId, userId)

      // Analyze lead's communication preferences
      const preferredStyle = await this.analyzeCommunicationPreferences(leadProfile)

      if (preferredStyle !== currentStyle) {
        logger.info('Adapting communication style', {
          leadId,
          from: currentStyle,
          to: preferredStyle
        })
        return preferredStyle
      }

      return currentStyle
    } catch (error) {
      logger.error('Error adapting communication style', error as Error, { leadId })
      return currentStyle
    }
  }

  // Private helper methods

  private async getLeadProfile(leadId: string, userId: string): Promise<LeadProfile> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead) {
        throw new Error('Lead not found')
      }

      // Get lead preferences
      const { data: preferences } = await supabase
        .from('lead_preferences')
        .select('*')
        .eq('lead_id', leadId)
        .single()

      return {
        id: lead.id,
        name: `${lead.first_name} ${lead.last_name}`.trim(),
        company: lead.company || '',
        role: lead.job_title || '',
        industry: lead.industry || '',
        painPoints: lead.pain_points || [],
        goals: lead.goals || [],
        preferences: preferences || {
          communicationStyle: 'professional',
          informationDepth: 'intermediate',
          decisionTimeline: 'medium'
        },
        personality: lead.personality || {
          type: 'professional',
          traits: ['analytical'],
          values: ['efficiency']
        }
      }
    } catch (error) {
      logger.error('Error getting lead profile', error as Error, { leadId })
      throw error
    }
  }

  private isHighQualityLead(leadProfile: LeadProfile): boolean {
    // Check if lead meets high-quality criteria
    // This would integrate with the lead scoring system
    return leadProfile.preferences.communicationStyle === 'professional' ||
           leadProfile.role.toLowerCase().includes('senior') ||
           leadProfile.company.length > 0
  }

  private async getConversationContext(leadId: string, userId: string): Promise<ConversationContext> {
    try {
      const supabase = await createClient()

      // Get or create conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('lead_id', leadId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (!conversation) {
        // Create new conversation context
        return {
          leadId,
          userId,
          conversationId: crypto.randomUUID(),
          currentTopic: '',
          conversationHistory: [],
          leadProfile: await this.getLeadProfile(leadId, userId),
          engagementLevel: 0,
          sentiment: 'neutral',
          relationshipStage: 'initial',
          lastInteraction: new Date(),
          preferredChannel: 'email'
        }
      }

      // Get conversation history
      const { data: messages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      const conversationHistory: ConversationMessage[] = (messages || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        metadata: msg.metadata || {},
        sentiment: msg.sentiment_score,
        intent: msg.intent,
        entities: msg.entities || []
      }))

      return {
        leadId,
        userId,
        conversationId: conversation.id,
        currentTopic: conversation.current_topic || '',
        conversationHistory,
        leadProfile: await this.getLeadProfile(leadId, userId),
        engagementLevel: conversation.engagement_level || 0,
        sentiment: conversation.sentiment || 'neutral',
        relationshipStage: conversation.relationship_stage || 'initial',
        lastInteraction: new Date(conversation.updated_at),
        preferredChannel: conversation.preferred_channel || 'email'
      }
    } catch (error) {
      logger.error('Error getting conversation context', error as Error, { leadId })
      throw error
    }
  }

  private async analyzeUserMessage(
    userMessage: string,
    conversationContext: ConversationContext
  ): Promise<any> {
    // Analyze user message using AI
    const prompt = `
      Analyze this user message in the context of the conversation:

      User Message: "${userMessage}"
      Conversation History: ${JSON.stringify(conversationContext.conversationHistory.slice(-5))}
      Lead Profile: ${JSON.stringify(conversationContext.leadProfile)}

      Provide analysis in JSON format:
      {
        "intent": "what the user wants",
        "sentiment": "positive|neutral|negative|excited",
        "urgency": "low|medium|high",
        "entities": ["extracted entities"],
        "topics": ["main topics"],
        "questions": ["specific questions asked"],
        "contextual_references": ["references to previous conversation"]
      }
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private selectPersonality(
    leadProfile: LeadProfile,
    conversationContext: ConversationContext
  ): PersonalityProfile {
    // Select personality based on lead profile and conversation context
    const personalities = Array.from(this.personalityProfiles.values())

    // Match personality to lead characteristics
    if (leadProfile.role.toLowerCase().includes('executive') ||
        leadProfile.role.toLowerCase().includes('ceo')) {
      return this.personalityProfiles.get('executive') || personalities[0]
    } else if (leadProfile.industry === 'technology' ||
               leadProfile.industry === 'startup') {
      return this.personalityProfiles.get('innovative') || personalities[0]
    } else if (conversationContext.relationshipStage === 'established') {
      return this.personalityProfiles.get('relationship') || personalities[0]
    }

    return this.personalityProfiles.get('professional') || personalities[0]
  }

  private async generateContextualResponse(
    userMessage: string,
    messageAnalysis: any,
    conversationContext: ConversationContext,
    personality: PersonalityProfile,
    userId: string
  ): Promise<EngagementResponse> {
    // Generate contextual response using AI
    const prompt = `
      Generate a human-like response to this user message:

      User Message: "${userMessage}"
      Message Analysis: ${JSON.stringify(messageAnalysis)}
      Conversation Context: ${JSON.stringify(conversationContext)}
      Personality Profile: ${JSON.stringify(personality)}

      Guidelines:
      1. Use natural, conversational language
      2. Match the personality traits and communication style
      3. Reference previous conversation when relevant
      4. Show empathy and understanding
      5. Ask relevant follow-up questions
      6. Keep response appropriate length

      Return JSON format:
      {
        "content": "the response content",
        "confidence": 0.95,
        "strategy": "relationship_building|information_providing|question_asking|empathy_showing",
        "nextActions": ["follow_up_question", "provide_resource", "schedule_call"],
        "metadata": {"tone": "friendly", "length": "medium"}
      }
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async updateConversationContext(
    conversationContext: ConversationContext,
    userMessage: string,
    assistantResponse: EngagementResponse,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      // Add user message
      await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationContext.conversationId,
          role: 'user',
          content: userMessage,
          created_at: new Date()
        })

      // Add assistant response
      await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationContext.conversationId,
          role: 'assistant',
          content: assistantResponse.content,
          metadata: assistantResponse.metadata,
          created_at: new Date()
        })

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          current_topic: this.extractTopicFromMessage(userMessage),
          engagement_level: Math.min(conversationContext.engagementLevel + 1, 10),
          sentiment: this.calculateOverallSentiment(conversationContext.conversationHistory),
          updated_at: new Date()
        })
        .eq('id', conversationContext.conversationId)
    } catch (error) {
      logger.error('Error updating conversation context', error as Error, { conversationId: conversationContext.conversationId })
    }
  }

  private async addHumanLikeDelay(): Promise<void> {
    // Add random delay to simulate human response time
    const delay = Math.random() * (this.config.responseDelayRange.max - this.config.responseDelayRange.min) +
                  this.config.responseDelayRange.min

    await new Promise(resolve => setTimeout(resolve, delay * 1000))
  }

  private async analyzeRelationshipStage(
    conversationHistory: ConversationMessage[],
    leadProfile: LeadProfile
  ): Promise<string> {
    const messageCount = conversationHistory.length

    if (messageCount < 3) return 'initial'
    if (messageCount < 10) return 'building'
    if (messageCount < 20) return 'established'

    return 'deep'
  }

  private async generateRelationshipBuildingResponse(
    leadProfile: LeadProfile,
    conversationContext: ConversationContext,
    relationshipStage: string,
    userId: string
  ): Promise<EngagementResponse> {
    const prompt = `
      Generate a relationship-building response:

      Lead Profile: ${JSON.stringify(leadProfile)}
      Relationship Stage: ${relationshipStage}
      Conversation Context: ${JSON.stringify(conversationContext)}

      Focus on:
      1. Building trust and rapport
      2. Showing genuine interest in their business
      3. Demonstrating expertise and value
      4. Moving the relationship forward naturally

      Return JSON format with response content and strategy.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async generateEmotionallyIntelligentResponse(
    userMessage: string,
    detectedEmotion: string,
    leadProfile: LeadProfile,
    conversationContext: ConversationContext,
    userId: string
  ): Promise<EngagementResponse> {
    const prompt = `
      Generate an emotionally intelligent response:

      User Message: "${userMessage}"
      Detected Emotion: ${detectedEmotion}
      Lead Profile: ${JSON.stringify(leadProfile)}

      Guidelines:
      1. Acknowledge and validate their emotion
      2. Show empathy and understanding
      3. Respond appropriately to the emotional context
      4. Maintain professional boundaries
      5. Guide conversation constructively

      Return JSON format with response content.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async analyzeFollowupOpportunities(
    conversationHistory: ConversationMessage[],
    leadProfile: LeadProfile,
    conversationContext: ConversationContext
  ): Promise<any> {
    const prompt = `
      Analyze conversation for follow-up opportunities:

      Conversation History: ${JSON.stringify(conversationHistory)}
      Lead Profile: ${JSON.stringify(leadProfile)}

      Identify:
      1. Unanswered questions
      2. Areas needing clarification
      3. Opportunities to provide value
      4. Natural next steps in conversation

      Return JSON with suggested followups.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async analyzeCommunicationPreferences(leadProfile: LeadProfile): Promise<string> {
    // Analyze lead profile to determine communication preferences
    const prompt = `
      Analyze lead profile for communication style preferences:

      Lead Profile: ${JSON.stringify(leadProfile)}

      Determine the most appropriate communication style:
      - formal: for executives and traditional businesses
      - professional: for most business contexts
      - friendly: for collaborative and innovative environments
      - casual: for startups and creative industries

      Return the recommended style.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    return response.choices[0].message.content.trim()
  }

  private generateStandardResponse(userMessage: string, context: Record<string, any>): EngagementResponse {
    // Generate standard (non-personalized) response
    return {
      content: `Thank you for your message. I'm here to help you with any questions you have.`,
      confidence: 0.7,
      strategy: 'standard_response',
      nextActions: ['ask_for_clarification'],
      metadata: { type: 'standard' }
    }
  }

  private generateFallbackResponse(userMessage: string): EngagementResponse {
    // Generate fallback response when errors occur
    return {
      content: `I understand you're saying: "${userMessage}". Let me help you with that.`,
      confidence: 0.5,
      strategy: 'fallback',
      nextActions: ['clarify_intent'],
      metadata: { type: 'fallback' }
    }
  }

  private extractTopicFromMessage(message: string): string {
    // Simple topic extraction - in production would use NLP
    const words = message.toLowerCase().split(' ')
    const businessWords = ['business', 'company', 'product', 'service', 'solution', 'help', 'need', 'question']

    for (const word of businessWords) {
      if (words.includes(word)) {
        return word
      }
    }

    return 'general'
  }

  private calculateOverallSentiment(conversationHistory: ConversationMessage[]): string {
    // Calculate overall sentiment from conversation history
    if (conversationHistory.length === 0) return 'neutral'

    const sentiments = conversationHistory
      .filter(msg => msg.sentiment !== undefined)
      .map(msg => msg.sentiment!)

    if (sentiments.length === 0) return 'neutral'

    const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length

    if (avgSentiment > 0.3) return 'positive'
    if (avgSentiment < -0.3) return 'negative'
    if (avgSentiment > 0.6) return 'excited'

    return 'neutral'
  }

  private getDefaultPersonalityProfiles(): Record<string, PersonalityProfile> {
    return {
      professional: {
        name: 'Professional',
        description: 'Standard professional communication style',
        traits: {
          tone: 'professional',
          communicationStyle: 'direct',
          pace: 'moderate',
          focus: 'results'
        },
        languagePatterns: {
          greetings: ['Hello', 'Good day', 'I hope this finds you well'],
          transitions: ['Moving on to', 'Regarding', 'In terms of'],
          closings: ['Best regards', 'Thank you for your time', 'I look forward to your response'],
          empathy: ['I understand that', 'I can see how', 'That makes sense'],
          enthusiasm: ['Excellent', 'Great point', 'I agree']
        },
        responseTemplates: {
          positive: ['That sounds excellent', 'I\'m glad to hear that', 'Perfect'],
          neutral: ['I see', 'That\'s interesting', 'Noted'],
          concerned: ['I understand your concern', 'That\'s a valid point', 'Let me address that'],
          excited: ['That\'s fantastic', 'Wonderful', 'I\'m excited about this']
        }
      },
      executive: {
        name: 'Executive',
        description: 'Communication style for senior executives',
        traits: {
          tone: 'formal',
          communicationStyle: 'direct',
          pace: 'fast',
          focus: 'results'
        },
        languagePatterns: {
          greetings: ['Good morning', 'I trust you\'re well', 'I appreciate your time'],
          transitions: ['To the point', 'Specifically', 'The key issue is'],
          closings: ['Thank you for your attention', 'I value your input', 'Let\'s proceed'],
          empathy: ['I recognize', 'I acknowledge', 'I respect'],
          enthusiasm: ['Outstanding', 'Impressive', 'Well done']
        },
        responseTemplates: {
          positive: ['Excellent decision', 'Strong performance', 'Well executed'],
          neutral: ['Understood', 'Acknowledged', 'Noted'],
          concerned: ['This requires attention', 'We need to address', 'Critical issue'],
          excited: ['Outstanding results', 'Exceptional work', 'Impressive achievement']
        }
      },
      innovative: {
        name: 'Innovative',
        description: 'Creative and innovative communication style',
        traits: {
          tone: 'casual',
          communicationStyle: 'storytelling',
          pace: 'moderate',
          focus: 'education'
        },
        languagePatterns: {
          greetings: ['Hey there', 'Great to connect', 'Hope you\'re having a good day'],
          transitions: ['What if we', 'Imagine', 'Let me share a story'],
          closings: ['Looking forward to your thoughts', 'Excited to hear from you', 'Let\'s explore this'],
          empathy: ['I get where you\'re coming from', 'That totally makes sense', 'I feel you'],
          enthusiasm: ['Awesome', 'Brilliant', 'Love that idea']
        },
        responseTemplates: {
          positive: ['That\'s brilliant', 'Love that approach', 'Perfect solution'],
          neutral: ['Interesting perspective', 'Good point', 'Makes sense'],
          concerned: ['I see the challenge', 'That\'s tricky', 'We should address that'],
          excited: ['This is amazing', 'So exciting', 'Game-changing']
        }
      },
      relationship: {
        name: 'Relationship',
        description: 'Relationship-focused communication style',
        traits: {
          tone: 'friendly',
          communicationStyle: 'collaborative',
          pace: 'slow',
          focus: 'relationship'
        },
        languagePatterns: {
          greetings: ['Great to hear from you', 'Always a pleasure', 'How have you been'],
          transitions: ['Building on that', 'Together we can', 'Let\'s work on this'],
          closings: ['Looking forward to our next conversation', 'Take care', 'Until next time'],
          empathy: ['I completely understand', 'I\'m here for you', 'That means a lot'],
          enthusiasm: ['Wonderful', 'Fantastic', 'I\'m thrilled']
        },
        responseTemplates: {
          positive: ['That\'s wonderful to hear', 'I\'m so happy for you', 'Excellent news'],
          neutral: ['I appreciate you sharing that', 'Thanks for letting me know', 'I value your input'],
          concerned: ['I\'m concerned about that', 'Let\'s work through this together', 'I\'m here to help'],
          excited: ['This is fantastic', 'I\'m thrilled about this', 'Wonderful opportunity']
        }
      }
    }
  }

  private initializePersonalityProfiles(): void {
    const profiles = this.getDefaultPersonalityProfiles()

    for (const [key, profile] of Object.entries(profiles)) {
      this.personalityProfiles.set(key, profile)
    }
  }

  private async loadPersonalityProfiles(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: profiles } = await supabase
        .from('personality_profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      for (const profile of profiles || []) {
        this.personalityProfiles.set(profile.name.toLowerCase(), profile as PersonalityProfile)
      }
    } catch (error) {
      logger.error('Error loading personality profiles', error as Error, { userId })
    }
  }
}

export const humanLikeEngagement = HumanLikeEngagement.getInstance()