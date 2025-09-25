/**
 * MCP API Routes
 * Provides endpoints for MCP-enhanced lead scoring and analysis
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, AuthenticationError } from "@/lib/errors"
import { mcpLeadEnhancer } from "@/lib/mcp/lead-enhancer"
import { mcpClient } from "@/lib/mcp/client"

// Validation schemas
const enhanceLeadSchema = z.object({
  leadId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  githubUsername: z.string().optional(),
  domain: z.string().optional(),
  originalScore: z.number().min(0).max(100)
})

const analyzeLeadSchema = z.object({
  email: z.string().email().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  githubUsername: z.string().optional(),
  linkedinUrl: z.string().url().optional()
})

// Enhanced lead scoring with MCP
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const { pathname } = new URL(request.url)
  const body = await request.json()

  // Route to specific handler based on path
  if (pathname.includes('/enhance')) {
    return handleLeadEnhancement(supabase, user, body)
  } else if (pathname.includes('/analyze')) {
    return handleLeadAnalysis(supabase, user, body)
  } else if (pathname.includes('/status')) {
    return handleMCPStatus(supabase, user, body)
  } else {
    // Default: Lead enhancement
    return handleLeadEnhancement(supabase, user, body)
  }
})

// Get MCP service status
export const GET = withErrorHandling(async (_request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const status = await mcpLeadEnhancer.getServiceStatus()
  
  return NextResponse.json({
    success: true,
    status,
    timestamp: new Date().toISOString()
  })
})

async function handleLeadEnhancement(supabase: any, user: any, body: any) {
  const validatedData = enhanceLeadSchema.parse(body)

  try {
    // Enhance lead score using MCP services
    const enhancement = await mcpLeadEnhancer.enhanceLeadScore(
      validatedData.originalScore,
      {
        email: validatedData.email,
        company: validatedData.company,
        jobTitle: validatedData.jobTitle,
        githubUsername: validatedData.githubUsername,
        domain: validatedData.domain
      }
    )

    // Update lead in database if leadId provided
    if (validatedData.leadId) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          lead_score: enhancement.finalScore,
          custom_fields: {
            ...validatedData,
            mcp_enhancement: {
              originalScore: enhancement.originalScore,
              mcpBonus: enhancement.mcpBonus,
              sources: enhancement.sources,
              enhancedAt: new Date().toISOString()
            }
          }
        })
        .eq('id', validatedData.leadId)
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error(`Failed to update lead: ${updateError.message}`)
      }

      // Log enhancement activity
      await supabase.from('lead_activities').insert({
        lead_id: validatedData.leadId,
        type: 'mcp_enhancement',
        details: {
          originalScore: enhancement.originalScore,
          finalScore: enhancement.finalScore,
          mcpBonus: enhancement.mcpBonus,
          sources: enhancement.sources,
          enhancements: enhancement.enhancements
        }
      })
    }

    return NextResponse.json({
      success: true,
      enhancement,
      message: `Lead score enhanced from ${enhancement.originalScore} to ${enhancement.finalScore} (+${enhancement.mcpBonus} from MCP services)`
    })

  } catch (error) {
    throw new Error(`MCP enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function handleLeadAnalysis(supabase: any, user: any, body: any) {
  const validatedData = analyzeLeadSchema.parse(body)

  try {
    // Analyze lead using multiple MCP sources
    const analysis = await mcpLeadEnhancer.analyzeLead(validatedData)

    // Store analysis in database for future reference
    const { data: analysisRecord, error: insertError } = await supabase
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event_name: 'mcp_lead_analysis',
        event_properties: {
          leadData: validatedData,
          analysis: analysis,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (insertError) {
      console.warn('Failed to store MCP analysis:', insertError.message)
    }

    return NextResponse.json({
      success: true,
      analysis,
      insights: generateInsights(analysis),
      analysisId: analysisRecord?.id
    })

  } catch (error) {
    throw new Error(`MCP analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function handleMCPStatus(_supabase: any, _user: any, _body: any) {
  try {
    const status = await mcpLeadEnhancer.getServiceStatus()
    const connectedServices = mcpClient.getConnectedServers()
    const healthCheck = await mcpClient.healthCheck()

    return NextResponse.json({
      success: true,
      status: {
        totalServices: connectedServices.length,
        connectedServices: connectedServices.map(s => s.name),
        capabilities: connectedServices.flatMap(s => s.capabilities),
        health: healthCheck,
        lastCheck: new Date().toISOString()
      }
    })

  } catch (error) {
    throw new Error(`MCP status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function generateInsights(analysis: any): string[] {
  const insights: string[] = []

  // GitHub insights
  if (analysis.profileAnalysis?.github) {
    const github = analysis.profileAnalysis.github
    if (github.followers > 1000) {
      insights.push(`🌟 Influential developer with ${github.followers.toLocaleString()} GitHub followers`)
    }
    if (github.publicRepos > 50) {
      insights.push(`⚡ Active contributor with ${github.publicRepos} public repositories`)
    }
    if (github.company) {
      insights.push(`🏢 Works at ${github.company}`)
    }
  }

  // Company insights
  if (analysis.marketIntelligence?.sentiment) {
    const sentiment = analysis.marketIntelligence.sentiment
    insights.push(`📈 Industry sentiment: ${sentiment.sentiment} (avg score: ${sentiment.avgScore})`)
  }

  // Technical insights
  if (analysis.technicalInsights?.relevantQuestions?.length > 0) {
    insights.push(`🔧 Active in technical communities (${analysis.technicalInsights.relevantQuestions.length} relevant Q&As found)`)
  }

  // Market sentiment
  if (analysis.marketIntelligence?.sentiment) {
    const sentiment = analysis.marketIntelligence.sentiment
    insights.push(`📈 Industry sentiment: ${sentiment.sentiment} (avg score: ${sentiment.avgScore})`)
  }

  return insights.length > 0 ? insights : ['No additional insights available from MCP services']
}