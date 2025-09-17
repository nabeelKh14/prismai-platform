"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, MicOff, Send, Square, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface MultimodalInputProps {
  onSendMessage: (content: string, modality: 'voice' | 'text') => Promise<void>
  disabled?: boolean
  placeholder?: string
}

export function MultimodalInput({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message or click the microphone to record..."
}: MultimodalInputProps) {
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [textInput, setTextInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const audioUrl = URL.createObjectURL(audioBlob)

        // Convert blob to base64 for sending
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64Audio = reader.result as string
          setIsProcessing(true)
          try {
            await onSendMessage(base64Audio, 'voice')
          } catch (error) {
            console.error('Failed to send voice message:', error)
          } finally {
            setIsProcessing(false)
          }
        }
        reader.readAsDataURL(audioBlob)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }, [onSendMessage])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }

      setRecordingTime(0)
    }
  }, [isRecording])

  const handleSendText = useCallback(async () => {
    if (!textInput.trim() || isProcessing) return

    setIsProcessing(true)
    try {
      await onSendMessage(textInput.trim(), 'text')
      setTextInput('')
    } catch (error) {
      console.error('Failed to send text message:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [textInput, isProcessing, onSendMessage])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }, [handleSendText])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-end gap-2">
          {/* Text Input */}
          <div className="flex-1">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={disabled || isRecording || isProcessing}
              className="min-h-[44px] resize-none"
            />
          </div>

          {/* Voice Recording Button */}
          <Button
            type="button"
            variant={inputMode === 'voice' ? 'default' : 'outline'}
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || isProcessing}
            className={cn(
              "h-11 w-11",
              isRecording && "bg-red-500 hover:bg-red-600 animate-pulse"
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          {/* Send Button */}
          <Button
            type="button"
            onClick={handleSendText}
            disabled={disabled || !textInput.trim() || isRecording || isProcessing}
            size="icon"
            className="h-11 w-11"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Recording Status */}
        {isRecording && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-500">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>Recording... {formatTime(recordingTime)}</span>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing your message...</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}