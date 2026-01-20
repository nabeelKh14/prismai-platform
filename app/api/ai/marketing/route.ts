import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError, AuthenticationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"

// Validation schemas
const emailCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  campaignType: z.enum(['newsletter', 'promotional', 'nurture', 'welcome', 'abandoned_cart']),
  targetAudience: z.object({
    segments: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    leadScore: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional(),
    lastActivity: z.string().optional()
  }).optional(),
  scheduledAt: z.string().datetime().optional(),
  personalizedContent: z.boolean().default(true)
})

const socialPostSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok']),
  contentType: z.enum(['promotional', 'educational', 'engaging', 'news', 'behind_scenes']),
  targetAudience: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  includeMedia: z.boolean().default(false),
  tone: z.enum(['professional', 'casual', 'friendly', 'authoritative', 'playful']).default('professional')
})

const automationWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  triggerType: z.enum(['lead_created', 'email_opened', 'form_submitted', 'date_based', 'behavior']),
  triggerConditions: z.record(z.any()),
  workflowSteps: z.array(z.object({
    type: z.enum(['email', 'wait', 'condition', 'tag', 'score_update', 'webhook']),
    config: z.record(z.any()),
    delay: z.number().optional()
  }))
})

// AI Marketing Content Engine
class MarketingContentEngine {
  static async generateEmailCampaign(
    campaignData: any,
    businessContext: any,
    targetAudience: any[]
  ): Promise<{
    subject: string
    content: string
    previewText: string
    personalizedVariants: any[]
  }> {
    try {
      const audienceInsights = targetAudience.length > 0 ? 
        `Target audience insights: ${JSON.stringify(targetAudience.slice(0, 5))}` : 
        'General audience'

      const prompt = `
Create an email campaign for ${businessContext.businessName || 'the business'}:

Campaign Details:
- Type: ${campaignData.campaignType}
- Name: ${campaignData.name}
- Business: ${businessContext.businessName || 'PrismAI'}
- Services: ${businessContext.services?.join(', ') || 'AI automation services'}

${audienceInsights}

Generate a complete email campaign with:
1. Compelling subject line (under 50 characters)
2. Preview text (under 90 characters)
3. Email content (HTML format, mobile-responsive)
4. 3 personalized variants for different audience segments

Focus on:
- Value proposition for AI business automation
- Clear call-to-action
- Professional yet engaging tone
- Personalization opportunities

Return as JSON:
{
  "subject": "subject line",
  "previewText": "preview text",
  "content": "full HTML email content",
  "personalizedVariants": [
    {
      "segment": "high_value_leads",
      "subject": "variant subject",
      "content": "variant content"
    }
  ]
}
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 2000,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')
    } catch (error) {
      console.error('Error generating email campaign:', error)
      
      return {
        subject: `${campaignData.name} - Special Update`,
        previewText: 'Important updates and offers inside',
        content: `
          <h2>Hello there!</h2>
          <p>We have some exciting updates to share with you about our AI business automation services.</p>
          <p><a href="#" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Learn More</a></p>
          <p>Best regards,<br>The Team</p>
        `,
        personalizedVariants: []
      }
    }
  }

  static async generateSocialContent(
    postData: any,
    businessContext: any
  ): Promise<{
    content: string
    hashtags: string[]
    mediaDescription: string
    variations: string[]
  }> {
    try {
      const prompt = `
Create engaging social media content for ${postData.platform}:

Business: ${businessContext.businessName || 'PrismAI'}
Content Type: ${postData.contentType}
Tone: ${postData.tone}
Services: ${businessContext.services?.join(', ') || 'AI automation services'}

Requirements for ${postData.platform}:
- Character limits and best practices
- Platform-specific formatting
- Engaging and valuable content
- Professional representation
- Clear value proposition

Generate:
1. Main post content
2. Relevant hashtags (5-10)
3. Media description if visual content needed
4. 2 alternative variations

Return as JSON:
{
  "content": "main post content",
  "hashtags": ["hashtag1", "hashtag2"],
  "mediaDescription": "description for visual content",
  "variations": ["variation1", "variation2"]
}
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        maxTokens: 1000,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')
    } catch (error) {
      console.error('Error generating social content:', error)
      
      return {
        content: `Exciting updates from our AI automation team! 🚀 Discover how artificial intelligence can transform your business operations. #AI #BusinessAutomation #Innovation`,
        hashtags: ['#AI', '#BusinessAutomation', '#Innovation', '#Technology', '#SmallBusiness'],
        mediaDescription: 'Professional image showing AI technology or business automation dashboard',
        variations: [
          'Transform your business with AI automation! See how leading companies are saving time and increasing efficiency.',
          'Ready to revolutionize your customer service? Our AI solutions are here to help you scale and succeed.'
        ]
      }
    }
  }

  static async optimizeAdCopy(
    originalAd: string,
    platform: string,
    targetAudience: any,
    performanceData: any
  ): Promise<{
    optimizedAd: string
    improvements: string[]
    suggestions: string[]
    variants: string[]
  }> {
    try {
      const prompt = `
Optimize this ${platform} ad copy for better performance:

Original Ad: "${originalAd}"
Target Audience: ${JSON.stringify(targetAudience)}
Performance Data: ${JSON.stringify(performanceData)}

Analyze and improve:
1. Headline effectiveness
2. Value proposition clarity
3. Call-to-action strength
4. Emotional triggers
5. Platform best practices

Provide:
- Optimized version
- List of improvements made
- Additional suggestions
- 3 A/B test variants

Return as JSON with the specified structure.
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        maxTokens: 1500,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')
    } catch (error) {
      console.error('Error optimizing ad copy:', error)
      
      return {
        optimizedAd: originalAd,
        improvements: ['Unable to optimize automatically'],
        suggestions: ['Consider A/B testing different headlines', 'Review target audience alignment'],
        variants: [originalAd]
      }
    }
  }
}

// Create email campaign
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
  if (pathname.includes('/email')) {
    return handleEmailCampaign(supabase, user, body)
  } else if (pathname.includes('/social')) {
    return handleSocialPost(supabase, user, body)
  } else if (pathname.includes('/workflow')) {
    return handleAutomationWorkflow(supabase, user, body)
  } else {
    // Default: Create email campaign
    return handleEmailCampaign(supabase, user, body)
  }
})

async function handleEmailCampaign(supabase: any, user: any, body: any) {
  const validatedData = emailCampaignSchema.parse(body)

  // Get business context
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const businessContext = {
    businessName: profile?.business_name || 'Your Business',
    services: ['PrismAI Assistant', 'Intelligent Automation', 'Customer Service'],
  }

  // Get target audience
  let targetAudience = []
  if (validatedData.targetAudience) {
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .gte('lead_score', validatedData.targetAudience.leadScore?.min || 0)
      .limit(100)

    targetAudience = leads || []
  }

  // Generate email content using AI
  const emailContent = await MarketingContentEngine.generateEmailCampaign(
    validatedData,
    businessContext,
    targetAudience
  )

  // Create campaign in database
  const { data: campaign, error: createError } = await supabase
    .from('email_campaigns')
    .insert({
      user_id: user.id,
      name: validatedData.name,
      subject: emailContent.subject,
      content: emailContent.content,
      campaign_type: validatedData.campaignType,
      scheduled_at: validatedData.scheduledAt,
      target_audience: validatedData.targetAudience || {},
      status: validatedData.scheduledAt ? 'scheduled' : 'draft',
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create campaign: ${createError.message}`)
  }

  return NextResponse.json({
    success: true,
    campaign,
    generatedContent: emailContent,
    targetAudienceSize: targetAudience.length
  })
}

async function handleSocialPost(supabase: any, user: any, body: any) {
  const validatedData = socialPostSchema.parse(body)

  // Get business context
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const businessContext = {
    businessName: profile?.business_name || 'Your Business',
    services: ['PrismAI Assistant', 'Intelligent Automation', 'Customer Service'],
  }

  // Generate social content using AI
  const socialContent = await MarketingContentEngine.generateSocialContent(
    validatedData,
    businessContext
  )

  // Create social post in database
  const { data: post, error: createError } = await supabase
    .from('social_posts')
    .insert({
      user_id: user.id,
      platform: validatedData.platform,
      content: socialContent.content,
      scheduled_at: validatedData.scheduledAt,
      status: validatedData.scheduledAt ? 'scheduled' : 'draft',
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create social post: ${createError.message}`)
  }

  return NextResponse.json({
    success: true,
    post,
    generatedContent: socialContent
  })
}

async function handleAutomationWorkflow(supabase: any, user: any, body: any) {
  const validatedData = automationWorkflowSchema.parse(body)

  // Create automation workflow
  const { data: workflow, error: createError } = await supabase
    .from('automation_workflows')
    .insert({
      user_id: user.id,
      name: validatedData.name,
      trigger_type: validatedData.triggerType,
      trigger_conditions: validatedData.triggerConditions,
      workflow_steps: validatedData.workflowSteps,
      is_active: true,
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create workflow: ${createError.message}`)
  }

  return NextResponse.json({
    success: true,
    workflow
  })
}

// Get marketing campaigns and posts
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
  const type = searchParams.get('type') // 'email', 'social', 'workflow'
  const status = searchParams.get('status')

  const results: { emailCampaigns?: any[]; socialPosts?: any[]; workflows?: any[] } = {}

  if (!type || type === 'email') {
    let emailQuery = supabase
      .from('email_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      emailQuery = emailQuery.eq('status', status)
    }

    const { data: emailCampaigns } = await emailQuery
    results.emailCampaigns = emailCampaigns || []
  }

  if (!type || type === 'social') {
    let socialQuery = supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      socialQuery = socialQuery.eq('status', status)
    }

    const { data: socialPosts } = await socialQuery
    results.socialPosts = socialPosts || []
  }

  if (!type || type === 'workflow') {
    const { data: workflows } = await supabase
      .from('automation_workflows')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    results.workflows = workflows || []
  }

  return NextResponse.json(results)
})