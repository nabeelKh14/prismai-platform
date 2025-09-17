import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError, AuthenticationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"
import { EnhancedLeadScoringEngine } from "@/lib/mcp/enhanced-lead-scoring"

// Validation schemas
const createLeadSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().min(1),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
})

const qualifyLeadSchema = z.object({
  leadId: z.string().uuid(),
})

const bulkImportSchema = z.object({
  leads: z.array(createLeadSchema).max(1000), // Limit bulk imports
  sourceId: z.string().uuid(),
})

// AI Lead Scoring Criteria
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
  }
}

class LeadScoringEngine {
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
  
  static async scoreCompany(company: string): Promise<number> {
    if (!company) return 5 // Default small business score
    
    // This could be enhanced with external APIs like Clearbit, LinkedIn, etc.
    // For now, we'll use simple heuristics
    
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
  
  static async calculateLeadScore(leadData: any): Promise<number> {
    let score = 0
    
    // Email scoring
    score += await this.scoreEmail(leadData.email)
    
    // Job title scoring
    score += await this.scoreJobTitle(leadData.jobTitle)
    
    // Company scoring
    score += await this.scoreCompany(leadData.company)
    
    // Engagement scoring (if available)
    if (leadData.engagement) {
      score += (leadData.engagement.form_completion || 0) * LEAD_SCORING_CRITERIA.engagement.form_completion
      score += (leadData.engagement.email_opens || 0) * LEAD_SCORING_CRITERIA.engagement.email_open
      score += (leadData.engagement.email_clicks || 0) * LEAD_SCORING_CRITERIA.engagement.email_click
      score += (leadData.engagement.website_visits || 0) * LEAD_SCORING_CRITERIA.engagement.website_visit
      score += (leadData.engagement.content_downloads || 0) * LEAD_SCORING_CRITERIA.engagement.content_download
    }
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score))
  }
}

// CREATE - Add new lead
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const body = await request.json()
  const validatedData = createLeadSchema.parse(body)

  // Calculate lead score with MCP enhancement
  const scoringResult = await EnhancedLeadScoringEngine.calculateLeadScore(validatedData)
  const leadScore = scoringResult.score

  // Create lead in database
  const { data: lead, error: createError } = await supabase
    .from("leads")
    .insert({
      user_id: user.id,
      email: validatedData.email,
      phone: validatedData.phone,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      company: validatedData.company,
      job_title: validatedData.jobTitle,
      lead_score: leadScore,
      custom_fields: {
        ...validatedData.customFields,
        mcp_enhancement: scoringResult.mcpEnhancement,
        scoring_breakdown: scoringResult.breakdown
      },
      tags: validatedData.tags || [],
      status: leadScore >= 70 ? 'qualified' : 'new',
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create lead: ${createError.message}`)
  }

  // Log lead creation activity
  await supabase.from("lead_activities").insert({
    lead_id: lead.id,
    type: 'lead_created',
    details: { source: validatedData.source, initial_score: leadScore }
  })

  return NextResponse.json({
    success: true,
    lead,
    leadScore,
    scoringBreakdown: scoringResult.breakdown,
    mcpEnhancement: scoringResult.mcpEnhancement,
    message: leadScore >= 70 ? 'High-quality lead created and qualified' : 'Lead created successfully'
  })
})

// GET - List leads with filtering and pagination
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const status = searchParams.get('status')
  const minScore = parseInt(searchParams.get('minScore') || '0')
  const source = searchParams.get('source')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select('*, lead_activities(count)', { count: 'exact' })
    .eq('user_id', user.id)

  // Apply filters
  if (status) {
    query = query.eq('status', status)
  }
  
  if (minScore > 0) {
    query = query.gte('lead_score', minScore)
  }
  
  if (source) {
    query = query.eq('source_id', source)
  }
  
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
  }

  // Apply pagination
  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false })

  const { data: leads, error: fetchError, count } = await query

  if (fetchError) {
    throw new Error(`Failed to fetch leads: ${fetchError.message}`)
  }

  return NextResponse.json({
    leads,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  })
})

// Bulk import leads
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const body = await request.json()
  const { leads: leadsData, sourceId } = bulkImportSchema.parse(body)

  const processedLeads = []
  const errors = []

  for (const [index, leadData] of leadsData.entries()) {
    try {
      const leadScore = await LeadScoringEngine.calculateLeadScore(leadData)
      
      const lead = {
        user_id: user.id,
        source_id: sourceId,
        email: leadData.email,
        phone: leadData.phone,
        first_name: leadData.firstName,
        last_name: leadData.lastName,
        company: leadData.company,
        job_title: leadData.jobTitle,
        lead_score: leadScore,
        custom_fields: leadData.customFields || {},
        tags: leadData.tags || [],
        status: leadScore >= 70 ? 'qualified' : 'new',
      }
      
      processedLeads.push(lead)
    } catch (error) {
      errors.push({
        index,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: leadData
      })
    }
  }

  if (processedLeads.length > 0) {
    const { data: insertedLeads, error: insertError } = await supabase
      .from('leads')
      .insert(processedLeads)
      .select()

    if (insertError) {
      throw new Error(`Failed to insert leads: ${insertError.message}`)
    }

    return NextResponse.json({
      success: true,
      imported: insertedLeads?.length || 0,
      errors: errors.length,
      errorDetails: errors
    })
  }

  return NextResponse.json({
    success: false,
    imported: 0,
    errors: errors.length,
    errorDetails: errors
  })
})