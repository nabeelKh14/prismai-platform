import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const timeRange = searchParams.get('timeRange') || '7d'

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Get conversation data for export
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id,
        customer_identifier,
        channel,
        status,
        created_at,
        updated_at,
        chat_messages (
          id,
          sender_type,
          content,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching data for export:', error)
      return NextResponse.json({ error: "Failed to fetch data for export" }, { status: 500 })
    }

    // Mock additional data for comprehensive export
    const mockAgentData = [
      { id: 'agent-1', name: 'Alice Johnson', conversations: 45, resolutionRate: 94.2, avgResponseTime: 45, satisfactionScore: 94.2 },
      { id: 'agent-2', name: 'Bob Smith', conversations: 38, resolutionRate: 91.8, avgResponseTime: 52, satisfactionScore: 91.8 },
      { id: 'agent-3', name: 'Carol Davis', conversations: 52, resolutionRate: 96.1, avgResponseTime: 38, satisfactionScore: 96.1 }
    ]

    if (format === 'csv') {
      // Generate CSV content
      let csvContent = 'Date,Customer,Channel,Status,Messages,Duration,Agent,Satisfaction\n'

      conversations?.forEach(conv => {
        const messages = conv.chat_messages || []
        const duration = Math.floor((new Date(conv.updated_at).getTime() - new Date(conv.created_at).getTime()) / 1000 / 60) // minutes
        const assignedAgent = mockAgentData.find(a => a.id === 'agent-' + Math.floor(Math.random() * 3 + 1))
        const satisfaction = Math.floor(Math.random() * 20) + 80 // Mock satisfaction score

        csvContent += `${new Date(conv.created_at).toISOString().split('T')[0]},`
        csvContent += `${conv.customer_identifier},`
        csvContent += `${conv.channel},`
        csvContent += `${conv.status},`
        csvContent += `${messages.length},`
        csvContent += `${duration},`
        csvContent += `${assignedAgent?.name || 'Unassigned'},`
        csvContent += `${satisfaction}\n`
      })

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="customer-service-analytics-${timeRange}.csv"`
        }
      })
    } else if (format === 'pdf') {
      // For PDF, we'll return a simple text representation
      // In a real implementation, you'd use a PDF library like pdfkit or puppeteer
      let pdfContent = `Customer Service Analytics Report - ${timeRange.toUpperCase()}\n\n`
      pdfContent += `Generated on: ${new Date().toLocaleDateString()}\n\n`
      pdfContent += `Total Conversations: ${conversations?.length || 0}\n`
      pdfContent += `Resolved: ${conversations?.filter(c => c.status === 'resolved').length || 0}\n`
      pdfContent += `Active: ${conversations?.filter(c => c.status === 'active' || c.status === 'assigned').length || 0}\n\n`

      pdfContent += 'Agent Performance:\n'
      mockAgentData.forEach(agent => {
        pdfContent += `- ${agent.name}: ${agent.conversations} conversations, ${agent.resolutionRate}% resolution rate\n`
      })

      return new NextResponse(pdfContent, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="customer-service-analytics-${timeRange}.pdf"`
        }
      })
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 })
  } catch (error) {
    console.error('Error in export API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}