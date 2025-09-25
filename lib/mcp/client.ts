/**
 * MCP (Model Context Protocol) Client
 * Manages connections to various MCP servers for enhanced functionality
 */

import { z } from 'zod'
import { logger } from '@/lib/logger'
import { intelligentCache } from './cache'
import { performanceMonitor } from './performance-monitor'

// MCP Message Types
const MCPRequestSchema = z.object({
  method: z.string(),
  params: z.record(z.any()).optional(),
  id: z.string().optional(),
})

const MCPResponseSchema = z.object({
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional(),
  }).optional(),
  id: z.string().optional(),
})

export interface MCPServer {
  name: string
  url?: string
  capabilities: string[]
  status: 'connected' | 'disconnected' | 'error'
  lastPing?: Date
}

export interface MCPRequest {
  method: string
  params?: Record<string, any>
  id?: string
}

export interface MCPResponse {
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
  id?: string
}

class MCPClient {
  private servers: Map<string, MCPServer> = new Map()
  private connections: Map<string, any> = new Map()

  constructor() {
    this.initializeFreeMCPs()
  }

  /**
   * Initialize free MCP servers
   */
  private initializeFreeMCPs() {
    const freeMCPs: MCPServer[] = [
      {
        name: 'github-mcp',
        capabilities: ['profile_analysis', 'repository_data', 'activity_tracking'],
        status: 'disconnected'
      },
      {
        name: 'clearbit-mcp',
        capabilities: ['company_enrichment', 'person_enrichment', 'email_verification'],
        status: 'disconnected'
      },
      {
        name: 'hunter-mcp',
        capabilities: ['email_finder', 'email_verifier', 'domain_search'],
        status: 'disconnected'
      },
      {
        name: 'discord-mcp',
        capabilities: ['message_handling', 'user_management', 'channel_automation'],
        status: 'disconnected'
      },
      {
        name: 'telegram-mcp',
        capabilities: ['bot_messaging', 'group_management', 'inline_queries'],
        status: 'disconnected'
      },
      {
        name: 'stackoverflow-mcp',
        capabilities: ['question_search', 'answer_retrieval', 'tag_analysis'],
        status: 'disconnected'
      },
      {
        name: 'reddit-mcp',
        capabilities: ['sentiment_analysis', 'trend_detection', 'community_insights'],
        status: 'disconnected'
      }
    ]

    freeMCPs.forEach(server => {
      this.servers.set(server.name, server)
    })
  }

  /**
   * Connect to an MCP server
   */
  async connect(serverName: string): Promise<boolean> {
    const server = this.servers.get(serverName)
    if (!server) {
      logger.error(`MCP server ${serverName} not found`)
      return false
    }

    try {
      // For demo purposes, we'll simulate connections
      // In a real implementation, you'd establish actual MCP connections
      server.status = 'connected'
      server.lastPing = new Date()
      this.servers.set(serverName, server)
      
      logger.info(`Connected to MCP server: ${serverName}`)
      return true
    } catch (error) {
      logger.error(`Failed to connect to MCP server ${serverName}:`, error)
      server.status = 'error'
      this.servers.set(serverName, server)
      return false
    }
  }

  /**
   * Send request to MCP server
   */
  async request(serverName: string, request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now()
    let cacheHit = false
    let dataSize = 0

    const server = this.servers.get(serverName)
    if (!server || server.status !== 'connected') {
      performanceMonitor.recordMetric({
        source: serverName,
        operation: request.method,
        duration: Date.now() - startTime,
        success: false,
        cacheHit: false,
        dataSize: 0,
        errorType: 'server_not_connected'
      })

      return {
        error: {
          code: -1,
          message: `MCP server ${serverName} not connected`
        }
      }
    }

    try {
      const validatedRequest = MCPRequestSchema.parse(request)

      // Route to appropriate handler based on server
      let response: MCPResponse
      switch (serverName) {
        case 'github-mcp':
          response = await this.handleGitHubMCP(validatedRequest)
          break
        case 'clearbit-mcp':
          response = await this.handleClearbitMCP(validatedRequest)
          break
        case 'hunter-mcp':
          response = await this.handleHunterMCP(validatedRequest)
          break
        case 'discord-mcp':
          response = await this.handleDiscordMCP(validatedRequest)
          break
        case 'telegram-mcp':
          response = await this.handleTelegramMCP(validatedRequest)
          break
        case 'stackoverflow-mcp':
          response = await this.handleStackOverflowMCP(validatedRequest)
          break
        case 'reddit-mcp':
          response = await this.handleRedditMCP(validatedRequest)
          break
        default:
          response = {
            error: {
              code: -2,
              message: `Handler not implemented for ${serverName}`
            }
          }
      }

      // Calculate data size if response has result
      if (response.result) {
        dataSize = JSON.stringify(response.result).length
      }

      // Record performance metric
      performanceMonitor.recordMetric({
        source: serverName,
        operation: request.method,
        duration: Date.now() - startTime,
        success: !response.error,
        cacheHit,
        dataSize,
        errorType: response.error ? 'api_error' : undefined
      })

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      // Record failed metric
      performanceMonitor.recordMetric({
        source: serverName,
        operation: request.method,
        duration,
        success: false,
        cacheHit: false,
        dataSize: 0,
        errorType: 'exception'
      })

      logger.error(`MCP request failed for ${serverName}:`, error)
      return {
        error: {
          code: -3,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  /**
   * GitHub MCP Handler
   */
  private async handleGitHubMCP(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'analyze_profile':
        const username = request.params?.username
        if (!username) {
          return { error: { code: 400, message: 'Username required' } }
        }

        try {
          // Check cache first
          const cacheKey = `github:${username}`
          const cachedData = await intelligentCache.get(cacheKey, 'github', async () => {
            const response = await fetch(`https://api.github.com/users/${username}`)
            const userData = await response.json()

            if (!response.ok) {
              throw new Error(userData.message || `GitHub API error: ${response.status}`)
            }

            return userData
          })

          if (!cachedData) {
            return { error: { code: 500, message: 'Failed to fetch GitHub profile' } }
          }

          // Analyze GitHub profile for lead scoring
          const analysis = {
            username: cachedData.login,
            name: cachedData.name,
            company: cachedData.company,
            followers: cachedData.followers,
            following: cachedData.following,
            publicRepos: cachedData.public_repos,
            accountAge: new Date().getFullYear() - new Date(cachedData.created_at).getFullYear(),
            leadScore: this.calculateGitHubLeadScore(cachedData)
          }

          return { result: analysis }
        } catch (error) {
          return { error: { code: 500, message: error instanceof Error ? error.message : 'GitHub API request failed' } }
        }

      default:
        return { error: { code: 404, message: `Method ${request.method} not found` } }
    }
  }


  /**
   * Clearbit MCP Handler (Free tier: 50 enrichments/month)
   */
  private async handleClearbitMCP(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'enrich_company':
        const domain = request.params?.domain
        if (!domain) {
          return { error: { code: 400, message: 'Domain required' } }
        }

        // Check cache first
        const cacheKey = `clearbit:${domain}`
        const cachedData = await intelligentCache.get(cacheKey, 'clearbit', async () => {
          // Simulate Clearbit API (you'd need actual API key for real implementation)
          const mockEnrichment = {
            domain,
            name: `${domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)} Inc`,
            employees: Math.floor(Math.random() * 10000) + 10,
            industry: 'Technology',
            funding: Math.floor(Math.random() * 100000000),
            location: 'San Francisco, CA'
          }

          return mockEnrichment
        })

        return { result: cachedData }

      default:
        return { error: { code: 404, message: `Method ${request.method} not found` } }
    }
  }

  /**
   * Hunter.io MCP Handler (Free tier: 25 searches/month)
   */
  private async handleHunterMCP(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'verify_email':
        const email = request.params?.email
        if (!email) {
          return { error: { code: 400, message: 'Email required' } }
        }

        // Simulate email verification
        const isValid = email.includes('@') && email.includes('.')
        const score = isValid ? Math.floor(Math.random() * 40) + 60 : Math.floor(Math.random() * 40)

        return {
          result: {
            email,
            valid: isValid,
            score,
            deliverable: score > 70,
            webmail: ['gmail.com', 'yahoo.com', 'hotmail.com'].some(domain => email.includes(domain))
          }
        }

      default:
        return { error: { code: 404, message: `Method ${request.method} not found` } }
    }
  }

  /**
   * Discord MCP Handler
   */
  private async handleDiscordMCP(request: MCPRequest): Promise<MCPResponse> {
    // Placeholder for Discord integration
    return { error: { code: 501, message: 'Discord MCP not yet implemented' } }
  }

  /**
   * Telegram MCP Handler
   */
  private async handleTelegramMCP(request: MCPRequest): Promise<MCPResponse> {
    // Placeholder for Telegram integration
    return { error: { code: 501, message: 'Telegram MCP not yet implemented' } }
  }

  /**
   * StackOverflow MCP Handler
   */
  private async handleStackOverflowMCP(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'search_questions':
        const query = request.params?.query
        if (!query) {
          return { error: { code: 400, message: 'Query required' } }
        }

        try {
          // Check cache first
          const cacheKey = `stackoverflow:${query}`
          const cachedData = await intelligentCache.get(cacheKey, 'stackoverflow', async () => {
            const searchUrl = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow`
            const response = await fetch(searchUrl)
            const data = await response.json()

            if (!response.ok) {
              throw new Error(`StackOverflow API error: ${response.status}`)
            }

            const questions = data.items?.slice(0, 3).map((item: any) => ({
              title: item.title,
              url: item.link,
              score: item.score,
              answered: item.is_answered,
              tags: item.tags
            })) || []

            return questions
          })

          return { result: cachedData }
        } catch (error) {
          return { error: { code: 500, message: error instanceof Error ? error.message : 'StackOverflow API request failed' } }
        }

      default:
        return { error: { code: 404, message: `Method ${request.method} not found` } }
    }
  }

  /**
   * Reddit MCP Handler
   */
  private async handleRedditMCP(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'analyze_sentiment':
        const subreddit = request.params?.subreddit || 'technology'
        
        try {
          const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=10`)
          const data = await response.json()

          const posts = data.data?.children?.map((child: any) => ({
            title: child.data.title,
            score: child.data.score,
            comments: child.data.num_comments,
            url: `https://reddit.com${child.data.permalink}`
          })) || []

          // Simple sentiment analysis
          const avgScore = posts.reduce((sum: number, post: any) => sum + post.score, 0) / posts.length
          const sentiment = avgScore > 100 ? 'positive' : avgScore > 0 ? 'neutral' : 'negative'

          return {
            result: {
              subreddit,
              sentiment,
              avgScore,
              posts: posts.slice(0, 5)
            }
          }
        } catch (error) {
          return { error: { code: 500, message: 'Reddit API request failed' } }
        }

      default:
        return { error: { code: 404, message: `Method ${request.method} not found` } }
    }
  }

  /**
   * Calculate GitHub-based lead score
   */
  private calculateGitHubLeadScore(userData: any): number {
    let score = 0
    
    // Followers indicate influence
    if (userData.followers > 1000) score += 20
    else if (userData.followers > 100) score += 15
    else if (userData.followers > 10) score += 10

    // Public repos indicate activity
    if (userData.public_repos > 50) score += 15
    else if (userData.public_repos > 10) score += 10
    else if (userData.public_repos > 0) score += 5

    // Company indicates professional status
    if (userData.company) score += 25

    // Account age indicates commitment
    const accountAge = new Date().getFullYear() - new Date(userData.created_at).getFullYear()
    if (accountAge > 5) score += 15
    else if (accountAge > 2) score += 10
    else if (accountAge > 0) score += 5

    return Math.min(100, score)
  }

  /**
   * Get all connected servers
   */
  getConnectedServers(): MCPServer[] {
    return Array.from(this.servers.values()).filter(server => server.status === 'connected')
  }

  /**
   * Get server status
   */
  getServerStatus(serverName: string): MCPServer | undefined {
    return this.servers.get(serverName)
  }

  /**
   * Disconnect from server
   */
  async disconnect(serverName: string): Promise<void> {
    const server = this.servers.get(serverName)
    if (server) {
      server.status = 'disconnected'
      this.connections.delete(serverName)
      this.servers.set(serverName, server)
      logger.info(`Disconnected from MCP server: ${serverName}`)
    }
  }

  /**
   * Health check for all servers
   */
  async healthCheck(): Promise<Record<string, 'healthy' | 'unhealthy'>> {
    const results: Record<string, 'healthy' | 'unhealthy'> = {}
    
    for (const [name, server] of this.servers) {
      try {
        if (server.status === 'connected') {
          // Simple ping test
          const pingResult = await this.request(name, { method: 'ping' })
          results[name] = pingResult.error ? 'unhealthy' : 'healthy'
        } else {
          results[name] = 'unhealthy'
        }
      } catch {
        results[name] = 'unhealthy'
      }
    }
    
    return results
  }
}

// Export singleton instance
export const mcpClient = new MCPClient()
export default mcpClient