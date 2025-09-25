/**
 * MCP Integration for Lead Scoring Enhancement
 * Enhances the existing lead scoring system with free MCP services
 */

import { mcpClient } from './client'
import { logger } from '@/lib/logger'

export interface EnhancedLeadData {
  email?: string
  company?: string
  jobTitle?: string
  githubUsername?: string
  domain?: string
  linkedinUrl?: string
}

export interface MCPEnhancedScore {
  originalScore: number
  mcpBonus: number
  finalScore: number
  enhancements: {
    github?: {
      score: number
      data: any
    }
    company?: {
      score: number
      data: any
    }
    email?: {
      score: number
      data: any
    }
    knowledge?: {
      score: number
      data: any
    }
  }
  sources: string[]
}

export class MCPLeadEnhancer {
  private static instance: MCPLeadEnhancer
  private initialized = false

  constructor() {
    this.initialize()
  }

  static getInstance(): MCPLeadEnhancer {
    if (!MCPLeadEnhancer.instance) {
      MCPLeadEnhancer.instance = new MCPLeadEnhancer()
    }
    return MCPLeadEnhancer.instance
  }

  private async initialize() {
    if (this.initialized) return

    try {
      // Connect to free MCP services
      await Promise.all([
        mcpClient.connect('github-mcp'),
        mcpClient.connect('clearbit-mcp'),
        mcpClient.connect('hunter-mcp'),
        mcpClient.connect('stackoverflow-mcp'),
        mcpClient.connect('reddit-mcp')
      ])

      this.initialized = true
      logger.info('MCP Lead Enhancer initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize MCP Lead Enhancer:', error instanceof Error ? error : { error })
    }
  }

  /**
   * Enhance lead scoring with MCP data
   */
  async enhanceLeadScore(
    originalScore: number, 
    leadData: EnhancedLeadData
  ): Promise<MCPEnhancedScore> {
    const result: MCPEnhancedScore = {
      originalScore,
      mcpBonus: 0,
      finalScore: originalScore,
      enhancements: {},
      sources: []
    }

    try {
      // GitHub Enhancement
      if (leadData.githubUsername) {
        const githubEnhancement = await this.enhanceWithGitHub(leadData.githubUsername)
        if (githubEnhancement) {
          result.enhancements.github = githubEnhancement
          result.mcpBonus += githubEnhancement.score
          result.sources.push('github')
        }
      }

      // Company Enhancement (Clearbit free tier)
      if (leadData.domain || leadData.company) {
        const domain = leadData.domain || this.extractDomain(leadData.email)
        if (domain) {
          const companyEnhancement = await this.enhanceWithCompanyData(domain)
          if (companyEnhancement) {
            result.enhancements.company = companyEnhancement
            result.mcpBonus += companyEnhancement.score
            result.sources.push('clearbit')
          }
        }
      }

      // Email Enhancement (Hunter.io free tier)
      if (leadData.email) {
        const emailEnhancement = await this.enhanceWithEmailVerification(leadData.email)
        if (emailEnhancement) {
          result.enhancements.email = emailEnhancement
          result.mcpBonus += emailEnhancement.score
          result.sources.push('hunter')
        }
      }

      // Knowledge Enhancement (Wikipedia + StackOverflow)
      if (leadData.company || leadData.jobTitle) {
        const knowledgeEnhancement = await this.enhanceWithKnowledge(leadData)
        if (knowledgeEnhancement) {
          result.enhancements.knowledge = knowledgeEnhancement
          result.mcpBonus += knowledgeEnhancement.score
          result.sources.push('knowledge')
        }
      }

      // Calculate final score (capped at 100)
      result.finalScore = Math.min(100, originalScore + result.mcpBonus)

      logger.info('Lead scoring enhanced via MCP', {
        originalScore,
        mcpBonus: result.mcpBonus,
        finalScore: result.finalScore,
        sources: result.sources
      })

    } catch (error) {
      logger.error('MCP lead enhancement failed:', error instanceof Error ? error : { error })
      result.finalScore = originalScore // Fallback to original score
    }

    return result
  }

  /**
   * GitHub profile enhancement
   */
  private async enhanceWithGitHub(username: string): Promise<{ score: number; data: any } | null> {
    try {
      const response = await mcpClient.request('github-mcp', {
        method: 'analyze_profile',
        params: { username }
      })

      if (response.error || !response.result) {
        return null
      }

      const githubData = response.result
      let score = 0

      // Score based on GitHub activity
      if (githubData.followers > 1000) score += 25
      else if (githubData.followers > 100) score += 20
      else if (githubData.followers > 10) score += 15

      if (githubData.publicRepos > 50) score += 20
      else if (githubData.publicRepos > 10) score += 15
      else if (githubData.publicRepos > 0) score += 10

      // Company association bonus
      if (githubData.company) score += 25

      // Account maturity bonus
      if (githubData.accountAge > 5) score += 15
      else if (githubData.accountAge > 2) score += 10

      return {
        score: Math.min(30, score), // Cap GitHub bonus at 30 points
        data: githubData
      }
    } catch (error) {
      logger.error('GitHub enhancement failed:', error instanceof Error ? error : { error })
      return null
    }
  }

  /**
   * Company data enhancement via Clearbit
   */
  private async enhanceWithCompanyData(domain: string): Promise<{ score: number; data: any } | null> {
    try {
      const response = await mcpClient.request('clearbit-mcp', {
        method: 'enrich_company',
        params: { domain }
      })

      if (response.error || !response.result) {
        return null
      }

      const companyData = response.result
      let score = 0

      // Score based on company size
      if (companyData.employees > 10000) score += 30
      else if (companyData.employees > 1000) score += 25
      else if (companyData.employees > 100) score += 20
      else if (companyData.employees > 10) score += 15

      // Funding bonus
      if (companyData.funding > 100000000) score += 20
      else if (companyData.funding > 10000000) score += 15
      else if (companyData.funding > 1000000) score += 10

      return {
        score: Math.min(25, score), // Cap company bonus at 25 points
        data: companyData
      }
    } catch (error) {
      logger.error('Company enhancement failed:', error instanceof Error ? error : { error })
      return null
    }
  }

  /**
   * Email verification enhancement
   */
  private async enhanceWithEmailVerification(email: string): Promise<{ score: number; data: any } | null> {
    try {
      const response = await mcpClient.request('hunter-mcp', {
        method: 'verify_email',
        params: { email }
      })

      if (response.error || !response.result) {
        return null
      }

      const emailData = response.result
      let score = 0

      // Score based on email quality
      if (emailData.score > 90) score += 15
      else if (emailData.score > 70) score += 10
      else if (emailData.score > 50) score += 5

      // Business email bonus
      if (!emailData.webmail) score += 10

      // Deliverability bonus
      if (emailData.deliverable) score += 5

      return {
        score: Math.min(15, score), // Cap email bonus at 15 points
        data: emailData
      }
    } catch (error) {
      logger.error('Email enhancement failed:', error instanceof Error ? error : { error })
      return null
    }
  }

  /**
   * Knowledge-based enhancement using StackOverflow
   */
  private async enhanceWithKnowledge(leadData: EnhancedLeadData): Promise<{ score: number; data: any } | null> {
    try {
      let score = 0
      const knowledgeData: any = {}

      // Technical knowledge from StackOverflow
      if (leadData.jobTitle?.toLowerCase().includes('developer') ||
          leadData.jobTitle?.toLowerCase().includes('engineer')) {
        const techResponse = await mcpClient.request('stackoverflow-mcp', {
          method: 'search_questions',
          params: { query: leadData.jobTitle }
        })

        if (techResponse.result?.length > 0) {
          knowledgeData.techQuestions = techResponse.result
          score += 10 // Bonus for technical leads
        }
      }

      return score > 0 ? {
        score: Math.min(10, score), // Cap knowledge bonus at 10 points
        data: knowledgeData
      } : null

    } catch (error) {
      logger.error('Knowledge enhancement failed:', error instanceof Error ? error : { error })
      return null
    }
  }

  /**
   * Extract domain from email
   */
  private extractDomain(email?: string): string | null {
    if (!email) return null
    const match = email.match(/@(.+)$/)
    return match ? match[1] : null
  }

  /**
   * Get MCP service status
   */
  async getServiceStatus(): Promise<Record<string, any>> {
    const connectedServers = mcpClient.getConnectedServers()
    const healthStatus = await mcpClient.healthCheck()

    return {
      connected: connectedServers.length,
      services: connectedServers.map(server => ({
        name: server.name,
        capabilities: server.capabilities,
        status: healthStatus[server.name] || 'unknown',
        lastPing: server.lastPing
      })),
      health: healthStatus
    }
  }

  /**
   * Analyze lead with multiple MCP sources
   */
  async analyzeLead(leadData: EnhancedLeadData): Promise<{
    profileAnalysis: any
    marketIntelligence: any
    technicalInsights: any
  }> {
    const analysis = {
      profileAnalysis: {} as any,
      marketIntelligence: {} as any,
      technicalInsights: {} as any
    }

    try {
      // Profile analysis
      if (leadData.githubUsername) {
        const githubProfile = await mcpClient.request('github-mcp', {
          method: 'analyze_profile',
          params: { username: leadData.githubUsername }
        })
        if (githubProfile.result) {
          analysis.profileAnalysis.github = githubProfile.result
        }
      }

      // Market intelligence
      if (leadData.company) {
        const redditSentiment = await mcpClient.request('reddit-mcp', {
          method: 'analyze_sentiment',
          params: { subreddit: 'technology' }
        })

        if (redditSentiment.result) analysis.marketIntelligence.sentiment = redditSentiment.result
      }

      // Technical insights
      if (leadData.jobTitle) {
        const techQuestions = await mcpClient.request('stackoverflow-mcp', {
          method: 'search_questions',
          params: { query: leadData.jobTitle }
        })
        if (techQuestions.result) {
          analysis.technicalInsights.relevantQuestions = techQuestions.result
        }
      }

    } catch (error) {
      logger.error('Lead analysis failed:', error instanceof Error ? error : { error })
    }

    return analysis
  }
}

// Export singleton instance
export const mcpLeadEnhancer = MCPLeadEnhancer.getInstance()
export default mcpLeadEnhancer