import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withErrorHandling, AuthenticationError, NotFoundError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"

// AI Lead Qualification Engine
class LeadQualificationEngine {
  static async qualifyLead(leadData: any): Promise<{
    isQualified: boolean
    score: number
    qualification: string
    recommendations: string[]
    nextSteps: string[]
  }> {
    try {
      const prompt = `
As an expert sales qualification AI, analyze this lead and provide a detailed qualification assessment:

Lead Information:
- Name: ${leadData.first_name} ${leadData.last_name}
- Company: ${leadData.company || 'Not provided'}
- Job Title: ${leadData.job_title || 'Not provided'}
- Email: ${leadData.email || 'Not provided'}
- Phone: ${leadData.phone || 'Not provided'}
- Current Score: ${leadData.lead_score}
- Source: ${leadData.source || 'Unknown'}
- Tags: ${leadData.tags?.join(', ') || 'None'}

Please provide a JSON response with:
{
  "isQualified": boolean,
  "updatedScore": number (0-100),
  "qualification": "detailed explanation of qualification status",
  "recommendations": ["array", "of", "specific", "recommendations"],
  "nextSteps": ["immediate", "actions", "to", "take"],
  "urgency": "high|medium|low",
  "estimatedValue": "potential deal value assessment",
  "timeline": "estimated time to close"
}

Consider BANT criteria (Budget, Authority, Need, Timeline) and modern sales qualification frameworks.
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      })

      const aiResponse = JSON.parse(response.choices[0]?.message?.content || '{}')

      return {
        isQualified: aiResponse.isQualified || false,
        score: Math.max(0, Math.min(100, aiResponse.updatedScore || leadData.lead_score)),
        qualification: aiResponse.qualification || 'Unable to assess qualification',
        recommendations: aiResponse.recommendations || [],
        nextSteps: aiResponse.nextSteps || []
      }
    } catch (error) {
      console.error('Error in AI lead qualification:', error)
      
      // Fallback scoring based on existing data
      let score = leadData.lead_score || 0
      
      // Simple qualification logic as fallback
      const hasCompany = !!leadData.company
      const hasJobTitle = !!leadData.job_title
      const hasBusinessEmail = leadData.email && !['gmail.com', 'yahoo.com', 'hotmail.com'].some(domain => 
        leadData.email.toLowerCase().includes(domain)
      )
      
      if (hasBusinessEmail) score += 15
      if (hasCompany) score += 10
      if (hasJobTitle) score += 10
      
      return {
        isQualified: score >= 60,
        score: Math.min(100, score),
        qualification: 'Basic qualification completed. Manual review recommended.',
        recommendations: [
          'Verify contact information',
          'Research company background',
          'Identify decision-making process'
        ],
        nextSteps: [
          'Schedule initial discovery call',
          'Send personalized follow-up email'
        ]
      }
    }
  }

  static async generatePersonalizedOutreach(leadData: any, qualification: any): Promise<{
    email: { subject: string; content: string }
    callScript: string
    socialMessage: string
  }> {
    try {
      const prompt = `
Generate personalized outreach content for this qualified lead:

Lead: ${leadData.first_name} ${leadData.last_name}
Company: ${leadData.company}
Role: ${leadData.job_title}
Qualification: ${qualification.qualification}
Urgency: ${qualification.urgency}

Create:
1. Email subject line and body (professional, value-focused)
2. Phone call script (conversational, discovery-focused)
3. LinkedIn/social message (brief, connection-oriented)

Make it relevant to PrismAI intelligent business automation services.
Format as JSON with "email", "callScript", and "socialMessage" keys.
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')
    } catch (error) {
      console.error('Error generating outreach content:', error)
      
      return {
        email: {
          subject: `PrismAI Business Automation Solutions for ${leadData.company}`,
          content: `Hi ${leadData.first_name},

I hope this email finds you well. I came across ${leadData.company} and was impressed by your work in the industry.

I'd love to share how PrismAI's intelligent business automation can help streamline your operations and improve customer service efficiency.

Would you be interested in a brief 15-minute conversation this week?

Best regards,
[Your Name]`
        },
        callScript: `Hi ${leadData.first_name}, this is [Your Name] calling about PrismAI business automation solutions. I understand you're at ${leadData.company} - I'd love to learn more about your current customer service processes and share how PrismAI can help streamline operations. Do you have a few minutes to chat?`,
        socialMessage: `Hi ${leadData.first_name}, I'd love to connect and share some insights about PrismAI automation for ${leadData.company}. Would you be open to connecting?`
      }
    }
  }
}

// Qualify a specific lead
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const { id: leadId } = await context.params

  // Fetch lead data
  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !lead) {
    throw new NotFoundError('Lead')
  }

  // Run AI qualification
  const qualification = await LeadQualificationEngine.qualifyLead(lead)
  
  // Generate personalized outreach content
  const outreach = await LeadQualificationEngine.generatePersonalizedOutreach(lead, qualification)

  // Update lead with new score and status
  const newStatus = qualification.isQualified ? 'qualified' : 'contacted'
  
  const { error: updateError } = await supabase
    .from('leads')
    .update({
      lead_score: qualification.score,
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId)

  if (updateError) {
    throw new Error(`Failed to update lead: ${updateError.message}`)
  }

  // Log qualification activity
  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'lead_qualified',
    details: {
      qualification_result: qualification,
      previous_score: lead.lead_score,
      new_score: qualification.score,
      ai_generated: true
    }
  })

  return NextResponse.json({
    success: true,
    qualification,
    outreach,
    updatedLead: {
      ...lead,
      lead_score: qualification.score,
      status: newStatus
    }
  })
})