"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Mic, MessageSquare, Play, Pause, Volume2, Clock, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { sanitizeHtml } from "@/lib/phi/sanitizer"
import type { Message } from "@/hooks/use-conversation"

interface ConversationDisplayProps {
  messages: Message[]
  isLoading?: boolean
}

export function ConversationDisplay({ messages, isLoading }: ConversationDisplayProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      audioRefs.current.forEach((audio) => {
        audio.pause()
        audio.src = ''
      })
      audioRefs.current.clear()
    }
  }, [])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSenderInfo = (senderType: Message['senderType']) => {
    switch (senderType) {
      case 'customer':
        return {
          name: 'You',
          avatar: '👤',
          color: 'bg-blue-500'
        }
      case 'ai':
        return {
          name: 'AI Assistant',
          avatar: '🤖',
          color: 'bg-purple-500'
        }
      case 'agent':
        return {
          name: 'Human Agent',
          avatar: '👨‍💼',
          color: 'bg-green-500'
        }
      default:
        return {
          name: 'Unknown',
          avatar: '❓',
          color: 'bg-gray-500'
        }
    }
  }

  const playAudio = async (messageId: string, audioUrl?: string) => {
    if (!audioUrl) return

    const existingAudio = audioRefs.current.get(messageId)
    if (existingAudio) {
      if (existingAudio.paused) {
        await existingAudio.play()
      } else {
        existingAudio.pause()
      }
      return
    }

    try {
      const audio = new Audio(audioUrl)
      audioRefs.current.set(messageId, audio)

      audio.onended = () => {
        audioRefs.current.delete(messageId)
      }

      await audio.play()
    } catch (error) {
      console.error('Failed to play audio:', error)
    }
  }

  const renderMessageContent = (message: Message) => {
    if (message.modality === 'voice') {
      return (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => playAudio(message.id, message.audioUrl)}
            className="flex items-center gap-2"
          >
            <Play className="h-3 w-3" />
            <Volume2 className="h-3 w-3" />
            Play Voice Message
          </Button>
          {message.content && (
            <div className="text-sm text-gray-600 italic">
              "{sanitizeHtml(message.content)}"
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="prose prose-sm max-w-none">
        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content) }} />
      </div>
    )
  }

  const renderMessageMetadata = (message: Message) => {
    const metadata = []

    if (message.processingTime) {
      metadata.push(
        <div key="processing-time" className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          {message.processingTime}ms
        </div>
      )
    }

    if (message.confidence) {
      metadata.push(
        <div key="confidence" className="flex items-center gap-1 text-xs text-gray-500">
          <Zap className="h-3 w-3" />
          {Math.round(message.confidence * 100)}% confidence
        </div>
      )
    }

    if (message.modality === 'voice') {
      metadata.push(
        <Badge key="modality" variant="secondary" className="text-xs">
          <Mic className="h-3 w-3 mr-1" />
          Voice
        </Badge>
      )
    } else {
      metadata.push(
        <Badge key="modality" variant="secondary" className="text-xs">
          <MessageSquare className="h-3 w-3 mr-1" />
          Text
        </Badge>
      )
    }

    return metadata.length > 0 ? (
      <div className="flex items-center gap-2 mt-2">
        {metadata}
      </div>
    ) : null
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg">Conversation</h3>
        <p className="text-sm text-gray-600">
          {messages.length} messages • Last activity: {messages.length > 0 ? formatTime(messages[messages.length - 1].timestamp) : 'None'}
        </p>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const senderInfo = getSenderInfo(message.senderType)
              const isCustomer = message.senderType === 'customer'

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    isCustomer ? "justify-end" : "justify-start"
                  )}
                >
                  {!isCustomer && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={cn("text-white text-xs", senderInfo.color)}>
                        {senderInfo.avatar}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className={cn(
                    "max-w-[70%] space-y-2",
                    isCustomer ? "order-first" : "order-last"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {senderInfo.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>

                    <div className={cn(
                      "rounded-lg p-3",
                      isCustomer
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900"
                    )}>
                      {renderMessageContent(message)}
                    </div>

                    {renderMessageMetadata(message)}
                  </div>

                  {isCustomer && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={cn("text-white text-xs", senderInfo.color)}>
                        {senderInfo.avatar}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )
            })
          )}

          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span>Loading messages...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}