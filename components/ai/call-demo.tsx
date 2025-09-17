"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Phone, PhoneCall, Square, Mic, MicOff, Volume2 } from "lucide-react"
import { VAPIClient, type CallStatus } from "@/lib/ai/vapi-client"

interface CallDemoProps {
  apiKey?: string
  assistantId?: string
}

export function CallDemo({ apiKey, assistantId }: CallDemoProps) {
  const [isCallActive, setIsCallActive] = useState(false)
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [transcript, setTranscript] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)

  const vapiClient = useRef<VAPIClient | null>(null)
  const wsConnection = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (apiKey) {
      vapiClient.current = new VAPIClient({ apiKey })
    }
  }, [apiKey])

  const startCall = async () => {
    if (!vapiClient.current || !assistantId || !phoneNumber) {
      setError("Missing required configuration")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const callResult = await vapiClient.current.makeCall(phoneNumber, assistantId)
      setCallStatus(callResult)
      setIsCallActive(true)

      // Connect to real-time updates
      wsConnection.current = vapiClient.current.connectToCallUpdates(callResult.id, (update) => {
        console.log("Call update:", update)

        if (update.type === "transcript") {
          setTranscript((prev) => [...prev, `${update.role}: ${update.text}`])
        }

        if (update.type === "status-update") {
          setCallStatus((prev) => (prev ? { ...prev, status: update.status } : null))

          if (update.status === "ended" || update.status === "failed") {
            setIsCallActive(false)
          }
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call")
    } finally {
      setIsLoading(false)
    }
  }

  const endCall = () => {
    if (wsConnection.current) {
      wsConnection.current.close()
    }
    setIsCallActive(false)
    setCallStatus(null)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    // In a real implementation, you would send mute/unmute commands to VAPI
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ringing":
        return "bg-yellow-500"
      case "in-progress":
        return "bg-green-500"
      case "ended":
        return "bg-gray-500"
      case "failed":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          PrismAI Demo
        </CardTitle>
        <CardDescription>
          Experience our AI receptionist in action. Enter a phone number to start a demo call.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isCallActive ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <Button onClick={startCall} disabled={!phoneNumber || isLoading} className="w-full" size="lg">
              {isLoading ? (
                "Starting Call..."
              ) : (
                <>
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Start Demo Call
                </>
              )}
            </Button>

            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Call Status */}
            <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(callStatus?.status || "ringing")}`} />
                <div>
                  <p className="font-medium">Call Status</p>
                  <p className="text-sm text-muted-foreground capitalize">{callStatus?.status || "Connecting..."}</p>
                </div>
              </div>

              <Badge variant="outline">
                {callStatus?.duration
                  ? `${Math.floor(callStatus.duration / 60)}:${(callStatus.duration % 60).toString().padStart(2, "0")}`
                  : "00:00"}
              </Badge>
            </div>

            {/* Call Controls */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                className={isMuted ? "bg-red-50 text-red-600" : ""}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Button variant="outline" size="icon">
                <Volume2 className="h-4 w-4" />
              </Button>

              <Button variant="destructive" onClick={endCall} className="px-6">
                <Square className="h-4 w-4 mr-2" />
                End Call
              </Button>
            </div>

            {/* Live Transcript */}
            <div className="space-y-2">
              <Label>Live Transcript</Label>
              <div className="bg-muted p-4 rounded-lg h-48 overflow-y-auto">
                {transcript.length > 0 ? (
                  <div className="space-y-2">
                    {transcript.map((line, index) => (
                      <div key={index} className="text-sm">
                        <span
                          className={line.startsWith("Assistant:") ? "text-primary font-medium" : "text-foreground"}
                        >
                          {line}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Transcript will appear here during the call...</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
