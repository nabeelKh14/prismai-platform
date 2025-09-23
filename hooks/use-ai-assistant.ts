"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface AIConfig {
  id: string
  user_id: string
  assistant_name: string
  greeting_message: string
  business_hours: Record<string, any>
  services: string[]
  elevenlabs_agent_id?: string
  vapi_phone_number?: string
}

export function useAIAssistant() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/ai/assistant")
      const data = await response.json()

      if (data.config) {
        setConfig(data.config)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch config")
    } finally {
      setIsLoading(false)
    }
  }

  const updateConfig = async (updates: Partial<AIConfig>) => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error("Failed to update configuration")
      }

      await fetchConfig()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update config")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const makeCall = async (phoneNumber: string) => {
    if (!config?.elevenlabs_agent_id) {
      throw new Error("AI assistant not configured")
    }

    try {
      const response = await fetch("/api/ai/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          assistantId: config.elevenlabs_agent_id,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to initiate call")
      }

      return response.json()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to make call")
    }
  }

  return {
    config,
    isLoading,
    error,
    updateConfig,
    makeCall,
    refetch: fetchConfig,
  }
}
