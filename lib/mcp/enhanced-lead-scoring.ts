/**
 * Enhanced Lead Scoring Engine with MCP Integration
 * Upgrades the existing lead scoring system with free MCP services
 */

import { mcpLeadEnhancer } from "@/lib/mcp/lead-enhancer"
import { geminiClient } from "@/lib/ai/gemini-client"
import { logger } from "@/lib/logger"

// Original scoring criteria (keeping existing logic)
const LEAD_SCORING_CRITERIA = {
  email_domain: {
    business_domains: 15, // @company.com vs @gmail.com
    free_email: -5,
  },
  job_title: {
    decision_maker: 25, // CEO, CTO, Director, Manager
    influencer: 15,     // Senior roles
    end_user: 5,
  },
  company_size: {
    enterprise: 30,     // 1000+ employees
    mid_market: 20,     // 100-999 employees  
    small_business: 10, // 10-99 employees
    startup: 5,         // <10 employees
  },
  engagement: {
    form_completion: 20,
    email_open: 5,
    email_click: 10,
    website_visit: 3,
    content_download: 15,
  },
  // NEW: MCP Enhancement bonuses
  mcp_enhancements: {
    github_developer: 30,       // Active GitHub profile
    verified_email: 15,         // Hunter.io verified email
    company_intelligence: 25,   // Clearbit company data
    technical_expertise: 20,    // StackOverflow activity
    industry_knowledge: 10      // Wikipedia/Reddit insights
  }
}

export class EnhancedLeadScoringEngine {
  
  /**
   * Calculate lead score with MCP enhancements
   */
  static async calculateLeadScore(leadData: any): Promise<{
    score: number
    breakdown: Record<string, any>
    mcpEnhancement?: any
  }> {
    let score = 0
    const breakdown: Record<string, any> = {}

    try {
      // Original scoring logic (unchanged)
      const emailScore = await this.scoreEmail(leadData.email)
      const jobTitleScore = await this.scoreJobTitle(leadData.jobTitle)
      const companyScore = await this.scoreCompany(leadData.company)
      const engagementScore = this.scoreEngagement(leadData.engagement)

      score += emailScore
      score += jobTitleScore
      score += companyScore
      score += engagementScore

      breakdown.email = emailScore
      breakdown.jobTitle = jobTitleScore
      breakdown.company = companyScore
      breakdown.engagement = engagementScore

      // NEW: MCP Enhancement
      let mcpEnhancement = null
      try {
        mcpEnhancement = await mcpLeadEnhancer.enhanceLeadScore(score, {
          email: leadData.email,
          company: leadData.company,
          jobTitle: leadData.jobTitle,
          githubUsername: leadData.githubUsername,
          domain: leadData.domain || this.extractDomain(leadData.email)
        })

        if (mcpEnhancement) {
          score = mcpEnhancement.finalScore
          breakdown.mcpBonus = mcpEnhancement.mcpBonus
          breakdown.mcpSources = mcpEnhancement.sources.join(', ')
        }
      } catch (mcpError) {
        logger.warn('MCP enhancement failed, using original score:', mcpError instanceof Error ? mcpError : { mcpError })
        // Continue with original score if MCP fails
      }

      // Ensure score is between 0 and 100
      const finalScore = Math.max(0, Math.min(100, score))
      
      return {
        score: finalScore,
        breakdown,
        mcpEnhancement
      }

    } catch (error) {
      logger.error('Lead scoring failed:', error instanceof Error ? error : { error })
      return {
        score: 0,
        breakdown: { error: 'Scoring failed' } as any
      }
    }
  }

  /**
   * Original email scoring (unchanged)
   */
  static async scoreEmail(email: string): Promise<number> {
    if (!email) return 0
    
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return 0
    
    // Check if it's a business domain (not free email)
    const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com']
    if (freeEmailDomains.includes(domain)) {
      return LEAD_SCORING_CRITERIA.email_domain.free_email
    }
    
    return LEAD_SCORING_CRITERIA.email_domain.business_domains
  }

  /**
   * Original job title scoring (unchanged)
   */
  static async scoreJobTitle(jobTitle: string): Promise<number> {
    if (!jobTitle) return 0
    
    const title = jobTitle.toLowerCase()
    
    // Decision makers
    const decisionMakers = ['ceo', 'cto', 'cfo', 'president', 'director', 'vp', 'vice president', 'founder', 'owner']
    if (decisionMakers.some(role => title.includes(role))) {
      return LEAD_SCORING_CRITERIA.job_title.decision_maker
    }
    
    // Influencers
    const influencers = ['senior', 'lead', 'manager', 'supervisor', 'coordinator']
    if (influencers.some(role => title.includes(role))) {
      return LEAD_SCORING_CRITERIA.job_title.influencer
    }
    
    return LEAD_SCORING_CRITERIA.job_title.end_user
  }

  /**
   * Original company scoring (unchanged)
   */
  static async scoreCompany(company: string): Promise<number> {
    if (!company) return 5 // Default small business score
    
    try {
      // Use AI to estimate company size based on name
      const prompt = `Based on the company name "${company}", estimate the company size category:
      - enterprise (1000+ employees)
      - mid_market (100-999 employees)
      - small_business (10-99 employees)
      - startup (fewer than 10 employees)
      
      Respond with just the category name.`
      
      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      })
      
      const category = response.choices[0]?.message?.content?.toLowerCase().trim()
      
      switch (category) {
        case 'enterprise':
          return LEAD_SCORING_CRITERIA.company_size.enterprise
        case 'mid_market':
          return LEAD_SCORING_CRITERIA.company_size.mid_market
        case 'small_business':
          return LEAD_SCORING_CRITERIA.company_size.small_business
        case 'startup':
          return LEAD_SCORING_CRITERIA.company_size.startup
        default:
          return LEAD_SCORING_CRITERIA.company_size.small_business
      }
    } catch (error) {
      console.error('Error scoring company:', error)
      return LEAD_SCORING_CRITERIA.company_size.small_business
    }
  }

  /**
   * Original engagement scoring (unchanged)
   */
  static scoreEngagement(engagement: any): number {
    if (!engagement) return 0

    let score = 0
    score += (engagement.form_completion || 0) * LEAD_SCORING_CRITERIA.engagement.form_completion
    score += (engagement.email_opens || 0) * LEAD_SCORING_CRITERIA.engagement.email_open
    score += (engagement.email_clicks || 0) * LEAD_SCORING_CRITERIA.engagement.email_click
    score += (engagement.website_visits || 0) * LEAD_SCORING_CRITERIA.engagement.website_visit
    score += (engagement.content_downloads || 0) * LEAD_SCORING_CRITERIA.engagement.content_download

    return score
  }

  /**
   * Extract domain from email
   */
  static extractDomain(email?: string): string | null {
    if (!email) return null
    const match = email.match(/@(.+)$/)
    return match ? match[1] : null
  }

  /**
   * Get scoring breakdown for analytics
   */
  static getScoringCriteria() {
    return {
      original: LEAD_SCORING_CRITERIA,
      mcpEnhanced: {
        maxOriginalScore: 75, // Approx max from original criteria
        maxMcpBonus: 50,      // Max additional from MCP services
        totalPossible: 100    // Capped at 100
      }
    }
  }

  /**
   * Analyze lead quality with MCP insights
   */
  static async analyzeLeadQuality(leadData: any): Promise<{
    score: number
    quality: 'high' | 'medium' | 'low'
    insights: string[]
    recommendations: string[]
    mcpAnalysis?: any
  }> {
    const scoring = await this.calculateLeadScore(leadData)
    let quality: 'high' | 'medium' | 'low' = 'low'
    const insights: string[] = []
    const recommendations: string[] = []

    // Determine quality tier
    if (scoring.score >= 80) quality = 'high'
    else if (scoring.score >= 60) quality = 'medium'

    // Generate insights
    if (scoring.breakdown.email > 10) {
      insights.push('✅ Business email domain detected')
    }
    if (scoring.breakdown.jobTitle >= 20) {
      insights.push('🎯 Decision-maker role identified')
    }
    if (scoring.breakdown.mcpBonus > 20) {
      insights.push('🚀 Enhanced with external data sources')
    }

    // Generate recommendations
    if (quality === 'high') {
      recommendations.push('🔥 Priority lead - immediate follow-up recommended')
      recommendations.push('📞 Consider direct call outreach')
    } else if (quality === 'medium') {
      recommendations.push('📧 Email nurture sequence recommended')
      recommendations.push('📊 Monitor engagement for scoring updates')
    } else {
      recommendations.push('📚 Educational content appropriate')
      recommendations.push('⏰ Long-term nurture sequence')
    }

    // Get MCP analysis if available
    let mcpAnalysis = null
    if (scoring.mcpEnhancement) {
      try {
        mcpAnalysis = await mcpLeadEnhancer.analyzeLead({
          email: leadData.email,
          company: leadData.company,
          jobTitle: leadData.jobTitle,
          githubUsername: leadData.githubUsername
        })
      } catch (error) {
        logger.warn('MCP analysis failed:', error instanceof Error ? error : { error })
      }
    }

    return {
      score: scoring.score,
      quality,
      insights,
      recommendations,
      mcpAnalysis
    }
  }
}

// Export for backward compatibility
export { EnhancedLeadScoringEngine as LeadScoringEngine }