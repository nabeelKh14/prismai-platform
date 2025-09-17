import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { indexRecommendationEngine } from "@/lib/monitoring/index-recommendation-engine"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status') as 'pending' | 'implemented' | 'rejected' || undefined
    const priority = url.searchParams.get('priority') as 'high' | 'medium' | 'low' || undefined
    const limit = parseInt(url.searchParams.get('limit') || '50')

    // Get existing recommendations
    const recommendations = await indexRecommendationEngine.getExistingRecommendations(status, priority)

    // Limit results
    const limitedRecommendations = recommendations.slice(0, limit)

    return NextResponse.json({
      recommendations: limitedRecommendations,
      totalCount: recommendations.length,
      filteredCount: limitedRecommendations.length,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in index recommendations API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for index recommendation actions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'analyze_database':
        // Run comprehensive index analysis
        const analysisResult = await indexRecommendationEngine.analyzeAndRecommendIndexes()
        return NextResponse.json({
          success: true,
          message: 'Database analysis completed',
          data: analysisResult
        })

      case 'implement_recommendation':
        // Implement a specific index recommendation
        if (params.recommendationId) {
          const success = await indexRecommendationEngine.implementRecommendation(params.recommendationId)
          return NextResponse.json({
            success,
            message: success
              ? `Index recommendation ${params.recommendationId} implemented successfully`
              : `Failed to implement index recommendation ${params.recommendationId}`
          })
        } else {
          return NextResponse.json({
            error: "Missing recommendationId parameter"
          }, { status: 400 })
        }

      case 'clear_cache':
        // Clear analysis cache
        indexRecommendationEngine.clearCache()
        return NextResponse.json({
          success: true,
          message: 'Index recommendation analysis cache cleared'
        })

      case 'get_analysis_summary':
        // Get a summary of the latest analysis
        const latestAnalysis = await indexRecommendationEngine.analyzeAndRecommendIndexes()
        const summary = {
          totalRecommendations: latestAnalysis.recommendations.length,
          highPriorityCount: latestAnalysis.recommendations.filter(r => r.priority === 'high').length,
          mediumPriorityCount: latestAnalysis.recommendations.filter(r => r.priority === 'medium').length,
          lowPriorityCount: latestAnalysis.recommendations.filter(r => r.priority === 'low').length,
          potentialPerformanceGain: latestAnalysis.analysisSummary.potentialPerformanceGain,
          analysisTimestamp: new Date().toISOString()
        }
        return NextResponse.json({
          success: true,
          data: summary
        })

      default:
        return NextResponse.json({
          error: "Invalid action",
          supportedActions: [
            'analyze_database',
            'implement_recommendation',
            'clear_cache',
            'get_analysis_summary'
          ]
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in index recommendations action API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT endpoint for updating recommendation status
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { recommendationId, status, notes } = body

    if (!recommendationId || !status) {
      return NextResponse.json({
        error: "Missing required parameters: recommendationId and status"
      }, { status: 400 })
    }

    if (!['pending', 'implemented', 'rejected'].includes(status)) {
      return NextResponse.json({
        error: "Invalid status. Must be one of: pending, implemented, rejected"
      }, { status: 400 })
    }

    // Update recommendation status in database
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'implemented') {
      updateData.implemented = true
      updateData.implemented_at = new Date().toISOString()
    }

    if (notes) {
      updateData.notes = notes
    }

    const { error } = await supabase
      .from('index_recommendations')
      .update(updateData)
      .eq('id', recommendationId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `Recommendation ${recommendationId} status updated to ${status}`
    })

  } catch (error) {
    console.error('Error updating recommendation status:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}