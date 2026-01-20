import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { emotionDetectionService } from "@/lib/ai/emotion-detection"
import { intentClassificationService } from "@/lib/ai/intent-classifier"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversation_id = searchParams.get('conversation_id')
    const flagged_only = searchParams.get('flagged_only') === 'true'

    let query = supabase
      .from('automated_quality_scores')
      .select(`
        *,
        quality_criteria (
          name,
          max_score
        ),
        chat_conversations (
          customer_identifier,
          channel,
          assigned_agent_id
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (conversation_id) {
      query = query.eq('conversation_id', conversation_id)
    }

    if (flagged_only) {
      query = query.eq('flagged_for_review', true)
    }

    const { data: scores, error } = await query

    if (error) {
      console.error('Error fetching automated quality scores:', error)
      return NextResponse.json({ error: "Failed to fetch quality scores" }, { status: 500 })
    }

    return NextResponse.json(scores)
  } catch (error) {
    console.error('Error in automated quality scores API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper function to enhance quality score with conversation intelligence
function enhanceQualityScoreWithIntelligence(
  baseScore: number,
  emotionAnalysis: any,
  intentAnalysis: any
): number {
  let enhancedScore = baseScore
  const adjustments = []

  // Positive emotion boost
  if (emotionAnalysis.overallSentiment === 'positive') {
    const boost = Math.min(emotionAnalysis.confidence * 5, 10) // Max 10 point boost
    enhancedScore += boost
    adjustments.push(`+${boost.toFixed(1)} for positive sentiment`)
  }

  // Negative emotion penalty
  if (emotionAnalysis.overallSentiment === 'negative') {
    const penalty = Math.min(emotionAnalysis.confidence * 8, 15) // Max 15 point penalty
    enhancedScore -= penalty
    adjustments.push(`-${penalty.toFixed(1)} for negative sentiment`)
  }

  // High urgency intent boost (indicates engaged customer)
  if (intentAnalysis.urgency === 'high' && intentAnalysis.confidence > 0.7) {
    const boost = Math.min(intentAnalysis.confidence * 3, 5) // Max 5 point boost
    enhancedScore += boost
    adjustments.push(`+${boost.toFixed(1)} for high urgency engagement`)
  }

  // Complex problem solving boost (indicates thorough assistance)
  if (intentAnalysis.complexity === 'complex' && intentAnalysis.confidence > 0.6) {
    const boost = Math.min(intentAnalysis.confidence * 4, 8) // Max 8 point boost
    enhancedScore += boost
    adjustments.push(`+${boost.toFixed(1)} for complex problem solving`)
  }

  // Confusion penalty (indicates unclear communication)
  if (intentAnalysis.primaryIntent === 'confusion' && intentAnalysis.confidence > 0.6) {
    const penalty = Math.min(intentAnalysis.confidence * 6, 10) // Max 10 point penalty
    enhancedScore -= penalty
    adjustments.push(`-${penalty.toFixed(1)} for customer confusion`)
  }

  // Off-topic penalty (indicates poor conversation management)
  if (intentAnalysis.primaryIntent === 'off_topic' && intentAnalysis.confidence > 0.7) {
    const penalty = Math.min(intentAnalysis.confidence * 5, 8) // Max 8 point penalty
    enhancedScore -= penalty
    adjustments.push(`-${penalty.toFixed(1)} for off-topic conversation`)
  }

  // Ensure score stays within 0-100 range
  enhancedScore = Math.max(0, Math.min(100, enhancedScore))

  logger.info('Quality score enhanced with conversation intelligence', {
    baseScore,
    enhancedScore,
    adjustments: adjustments.join(', ')
  })

  return Math.round(enhancedScore)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      conversation_id,
      criteria_id,
      overall_score,
      criteria_scores,
      confidence_score,
      reasoning,
      flagged_for_review,
      text,
      enable_conversation_intelligence = true
    } = body

    if (!conversation_id || overall_score === undefined) {
      return NextResponse.json({
        error: "Conversation ID and overall score are required"
      }, { status: 400 })
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const { data: score, error } = await supabase
      .from('automated_quality_scores')
      .upsert({
        conversation_id,
        criteria_id,
        overall_score,
        criteria_scores: criteria_scores || {},
        confidence_score: confidence_score || 0.8,
        reasoning,
        flagged_for_review: flagged_for_review || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating automated quality score:', error)
      return NextResponse.json({ error: "Failed to create quality score" }, { status: 500 })
    }

    // Enhanced quality scoring with conversation intelligence
    let enhancedScore = overall_score
    let intelligenceInsights = null

    if (enable_conversation_intelligence && text) {
      try {
        // Run conversation intelligence analysis
        const [emotionAnalysis, intentAnalysis] = await Promise.all([
          emotionDetectionService.detectEmotions({
            text,
            conversationId: conversation_id,
            language: 'en'
          }),
          intentClassificationService.classifyIntent({
            text,
            conversationId: conversation_id,
            language: 'en'
          })
        ])

        intelligenceInsights = {
          emotion: emotionAnalysis,
          intent: intentAnalysis
        }

        // Enhance quality score based on conversation intelligence
        enhancedScore = enhanceQualityScoreWithIntelligence(
          overall_score,
          emotionAnalysis,
          intentAnalysis
        )

        logger.info('Enhanced quality score with conversation intelligence', {
          conversationId: conversation_id,
          originalScore: overall_score,
          enhancedScore,
          dominantEmotion: emotionAnalysis.dominantEmotion,
          primaryIntent: intentAnalysis.primaryIntent
        })

      } catch (intelligenceError) {
        logger.error('Failed to enhance quality score with conversation intelligence', intelligenceError as Error, {
          conversationId: conversation_id
        })
        // Continue with original scoring if intelligence fails
      }
    }

    // Create quality score with enhanced scoring
    const { data: qualityScore, error: qualityError } = await supabase
      .from('automated_quality_scores')
      .upsert({
        conversation_id,
        criteria_id,
        overall_score: enhancedScore,
        criteria_scores: criteria_scores || {},
        confidence_score: confidence_score || 0.8,
        reasoning: enhancedScore !== overall_score
          ? `${reasoning || ''}\n\nEnhanced with conversation intelligence analysis.`
          : reasoning,
        flagged_for_review: flagged_for_review || false,
        intelligence_data: intelligenceInsights
      })
      .select()
      .single()

    if (qualityError) {
      console.error('Error creating enhanced automated quality score:', qualityError)
      return NextResponse.json({ error: "Failed to create quality score" }, { status: 500 })
    }

    // If flagged for review, create a quality recommendation
    if (flagged_for_review && enhancedScore < 70) {
      await supabase
        .from('quality_recommendations')
        .insert({
          conversation_id,
          recommendation_type: 'quality_score',
          severity: enhancedScore < 50 ? 'high' : 'medium',
          description: `Automated quality score of ${enhancedScore}% flagged for review${intelligenceInsights ? ' (enhanced with AI analysis)' : ''}`,
          suggested_action: 'Review conversation and provide manual quality assessment',
          intelligence_insights: intelligenceInsights
        })
    }

    return NextResponse.json({
      ...qualityScore,
      intelligence_enhanced: enhancedScore !== overall_score,
      original_score: overall_score,
      intelligence_insights: intelligenceInsights
    })
  } catch (error) {
    console.error('Error in automated quality scores POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}