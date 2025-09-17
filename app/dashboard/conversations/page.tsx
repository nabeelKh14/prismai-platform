import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Phone, Smartphone, Globe, Clock, User, TrendingUp, TrendingDown, Minus, AlertTriangle, Smile, Frown, Meh } from "lucide-react"

export default async function ConversationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please log in</div>
  }

  // Get conversations with messages
  const { data: conversations } = await supabase
    .from('chat_conversations')
    .select(`
      *,
      chat_messages (
        id,
        sender_type,
        content,
        message_type,
        metadata,
        created_at,
        detected_language,
        translated_from,
        translated_to
      )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  // Group conversations by channel
  const conversationsByChannel = {
    website: conversations?.filter(c => c.channel === 'website') || [],
    whatsapp: conversations?.filter(c => c.channel === 'whatsapp') || [],
    sms: conversations?.filter(c => c.channel === 'sms') || [],
    all: conversations || []
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4" />
      case 'sms':
        return <Smartphone className="h-4 w-4" />
      case 'website':
        return <Globe className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'bg-green-100 text-green-800'
      case 'sms':
        return 'bg-blue-100 text-blue-800'
      case 'website':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const ConversationCard = ({ conversation }: { conversation: any }) => {
    const lastMessage = conversation.chat_messages?.[conversation.chat_messages.length - 1]
    const messageCount = conversation.chat_messages?.length || 0

    // Calculate sentiment from messages
    const messagesWithSentiment = conversation.chat_messages?.filter((msg: any) => msg.metadata?.sentiment_score !== undefined) || []
    const avgSentiment = messagesWithSentiment.length > 0
      ? messagesWithSentiment.reduce((sum: number, msg: any) => sum + msg.metadata.sentiment_score, 0) / messagesWithSentiment.length
      : null

    const getSentimentIcon = (score: number | null) => {
      if (score === null) return <Minus className="h-4 w-4 text-gray-400" />
      if (score > 0.1) return <Smile className="h-4 w-4 text-green-500" />
      if (score < -0.1) return <Frown className="h-4 w-4 text-red-500" />
      return <Meh className="h-4 w-4 text-yellow-500" />
    }

    const getSentimentColor = (score: number | null) => {
      if (score === null) return 'bg-gray-100 text-gray-800'
      if (score > 0.1) return 'bg-green-100 text-green-800'
      if (score < -0.1) return 'bg-red-100 text-red-800'
      return 'bg-yellow-100 text-yellow-800'
    }

    const getUrgencyBadge = () => {
      const urgencyMessages = conversation.chat_messages?.filter((msg: any) => msg.metadata?.urgency === 'high') || []
      if (urgencyMessages.length > 0) {
        return <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />High Priority</Badge>
      }
      const mediumUrgency = conversation.chat_messages?.filter((msg: any) => msg.metadata?.urgency === 'medium') || []
      if (mediumUrgency.length > 0) {
        return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">Medium Priority</Badge>
      }
      return null
    }

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getChannelIcon(conversation.channel)}
              <Badge className={getChannelColor(conversation.channel)}>
                {conversation.channel}
              </Badge>
              {conversation.preferred_language && conversation.preferred_language !== 'en' && (
                <Badge variant="outline">
                  {conversation.preferred_language.toUpperCase()}
                </Badge>
              )}
              {avgSentiment !== null && (
                <Badge className={getSentimentColor(avgSentiment)}>
                  {getSentimentIcon(avgSentiment)}
                  <span className="ml-1">
                    {avgSentiment > 0.1 ? 'Positive' : avgSentiment < -0.1 ? 'Negative' : 'Neutral'}
                  </span>
                </Badge>
              )}
              {getUrgencyBadge()}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(conversation.updated_at).toLocaleDateString()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">{conversation.customer_identifier}</span>
            <Badge variant={conversation.status === 'active' ? 'default' : conversation.status === 'escalated' ? 'destructive' : 'secondary'}>
              {conversation.status}
            </Badge>
            {conversation.priority && (
              <Badge variant="outline" className="text-xs">
                {conversation.priority} priority
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lastMessage && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {messageCount} messages • Last: {lastMessage.sender_type === 'customer' ? 'Customer' : lastMessage.sender_type === 'agent' ? 'Agent' : 'AI'}
              </p>
              <p className="text-sm line-clamp-2">
                {lastMessage.content}
              </p>
              {lastMessage.detected_language && lastMessage.detected_language !== 'en' && (
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {lastMessage.translated_from && (
                    <span>Translated from {lastMessage.translated_from.toUpperCase()}</span>
                  )}
                  {lastMessage.translated_to && (
                    <span>to {lastMessage.translated_to.toUpperCase()}</span>
                  )}
                </div>
              )}

              {/* AI Insights */}
              <div className="flex flex-wrap gap-2 mt-2">
                {lastMessage.metadata?.topics && lastMessage.metadata.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {lastMessage.metadata.topics.slice(0, 3).map((topic: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                )}
                {lastMessage.metadata?.emotions && lastMessage.metadata.emotions.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Emotions: {lastMessage.metadata.emotions.join(', ')}
                  </div>
                )}
              </div>

              {/* Conversation Summary */}
              {conversation.summary && (
                <div className="mt-3 p-2 bg-blue-50 rounded-md">
                  <p className="text-xs font-medium text-blue-800 mb-1">AI Summary</p>
                  <p className="text-xs text-blue-700 line-clamp-2">{conversation.summary}</p>
                </div>
              )}

              {/* Escalation Info */}
              {conversation.escalation_reason && (
                <div className="mt-2 p-2 bg-red-50 rounded-md">
                  <p className="text-xs font-medium text-red-800 mb-1">Escalated</p>
                  <p className="text-xs text-red-700">{conversation.escalation_reason}</p>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm">
              View Conversation
            </Button>
            {conversation.status === 'resolved' && !conversation.summary && (
              <Button variant="outline" size="sm" className="text-xs">
                Generate Summary
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Conversations</h1>
        <p className="text-muted-foreground">Monitor and manage customer conversations across all channels</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({conversationsByChannel.all.length})</TabsTrigger>
          <TabsTrigger value="website">Website ({conversationsByChannel.website.length})</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp ({conversationsByChannel.whatsapp.length})</TabsTrigger>
          <TabsTrigger value="sms">SMS ({conversationsByChannel.sms.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="space-y-4">
            {conversationsByChannel.all.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
                  <p className="text-muted-foreground text-center">
                    Conversations from all channels will appear here once customers start interacting with your chatbot.
                  </p>
                </CardContent>
              </Card>
            ) : (
              conversationsByChannel.all.map((conversation) => (
                <ConversationCard key={conversation.id} conversation={conversation} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="website" className="mt-6">
          <div className="space-y-4">
            {conversationsByChannel.website.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No website conversations</h3>
                  <p className="text-muted-foreground text-center">
                    Website-based conversations will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              conversationsByChannel.website.map((conversation) => (
                <ConversationCard key={conversation.id} conversation={conversation} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <div className="space-y-4">
            {conversationsByChannel.whatsapp.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No WhatsApp conversations</h3>
                  <p className="text-muted-foreground text-center">
                    WhatsApp conversations will appear here once configured.
                  </p>
                </CardContent>
              </Card>
            ) : (
              conversationsByChannel.whatsapp.map((conversation) => (
                <ConversationCard key={conversation.id} conversation={conversation} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="sms" className="mt-6">
          <div className="space-y-4">
            {conversationsByChannel.sms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No SMS conversations</h3>
                  <p className="text-muted-foreground text-center">
                    SMS conversations will appear here once configured.
                  </p>
                </CardContent>
              </Card>
            ) : (
              conversationsByChannel.sms.map((conversation) => (
                <ConversationCard key={conversation.id} conversation={conversation} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}