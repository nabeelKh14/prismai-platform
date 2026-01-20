import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIAssistant } from '@/hooks/use-ai-assistant'
import { TestDataFactory, MockUtils } from '../utils/test-utils'

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('useAIAssistant', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with loading state', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: null }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.config).toBe(null)
    expect(result.current.error).toBe(null)
  })

  it('should fetch and set AI assistant config successfully', async () => {
    const mockConfig = TestDataFactory.createUser({
      id: 'test-ai-config-id',
      assistant_name: 'Test Assistant',
      greeting_message: 'Hello! How can I help you today?',
      business_hours: { '9-17': true },
      services: ['customer_support', 'sales'],
      vapi_agent_id: 'test-vapi-agent-id',
      vapi_phone_number: '+1234567890'
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: mockConfig }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.config).toEqual(mockConfig)
    expect(result.current.error).toBe(null)
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/assistant')
  })

  it('should handle fetch config error', async () => {
    const errorMessage = 'Failed to fetch AI assistant config'
    mockFetch.mockRejectedValueOnce(new Error(errorMessage))

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe(errorMessage)
    expect(result.current.config).toBe(null)
  })

  it('should handle API error response', async () => {
    const errorMessage = 'AI assistant not configured'
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: errorMessage }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch config')
    expect(result.current.config).toBe(null)
  })

  it('should update config successfully', async () => {
    const initialConfig = {
      id: 'test-ai-config-id',
      user_id: 'test-user-id',
      assistant_name: 'Test Assistant',
      greeting_message: 'Hello! How can I help you today?',
      business_hours: { '9-17': true },
      services: ['customer_support', 'sales'],
      vapi_agent_id: 'test-vapi-agent-id',
      vapi_phone_number: '+1234567890'
    }

    const updatedConfig = {
      ...initialConfig,
      assistant_name: 'Updated Assistant',
      greeting_message: 'Hi there! What can I do for you?'
    }

    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: initialConfig }),
    } as Response)

    // Mock update request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    // Mock refetch after update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: updatedConfig }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toEqual(initialConfig)
    })

    // Update config
    let updateResult: boolean = false
    await act(async () => {
      updateResult = await result.current.updateConfig({
        assistant_name: 'Updated Assistant',
        greeting_message: 'Hi there! What can I do for you?'
      })
    })

    expect(updateResult).toBe(true)
    expect(result.current.error).toBe(null)

    // Should refetch config after update
    await waitFor(() => {
      expect(result.current.config).toEqual(updatedConfig)
    })
  })

  it('should handle update config error', async () => {
    const initialConfig = {
      id: 'test-ai-config-id',
      user_id: 'test-user-id',
      assistant_name: 'Test Assistant',
      greeting_message: 'Hello! How can I help you today?',
      business_hours: { '9-17': true },
      services: ['customer_support', 'sales'],
      vapi_agent_id: 'test-vapi-agent-id',
      vapi_phone_number: '+1234567890'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: initialConfig }),
    } as Response)

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toEqual(initialConfig)
    })

    let updateResult: boolean = false
    await act(async () => {
      updateResult = await result.current.updateConfig({
        assistant_name: 'Updated Assistant'
      })
    })

    expect(updateResult).toBe(false)
    expect(result.current.error).toBe('Failed to update configuration')
    expect(result.current.config).toEqual(initialConfig) // Should not change on error
  })

  it('should make call successfully when config exists', async () => {
    const config = {
      id: 'test-ai-config-id',
      user_id: 'test-user-id',
      assistant_name: 'Test Assistant',
      greeting_message: 'Hello! How can I help you today?',
      business_hours: { '9-17': true },
      services: ['customer_support', 'sales'],
      vapi_agent_id: 'test-vapi-agent-id',
      vapi_phone_number: '+1234567890'
    }

    const callResponse = { callId: 'test-call-123', status: 'initiated' }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config }),
    } as Response)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(callResponse),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toEqual(config)
    })

    let callResult: any
    await act(async () => {
      callResult = await result.current.makeCall('+1234567890')
    })

    expect(callResult).toEqual(callResponse)
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/call', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: '+1234567890',
        assistantId: config.vapi_agent_id,
      }),
    }))
  })

  it('should throw error when making call without config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: null }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toBe(null)
    })

    await expect(result.current.makeCall('+1234567890')).rejects.toThrow('AI assistant not configured')
  })

  it('should handle make call API error', async () => {
    const config = TestDataFactory.createUser({
      id: 'test-ai-config-id',
      assistant_name: 'Test Assistant',
      greeting_message: 'Hello! How can I help you today?',
      business_hours: { '9-17': true },
      services: ['customer_support', 'sales'],
      vapi_agent_id: 'test-vapi-agent-id',
      vapi_phone_number: '+1234567890'
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config }),
    } as Response)

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Call service unavailable' }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toEqual(config)
    })

    await expect(result.current.makeCall('+1234567890')).rejects.toThrow('Failed to initiate call')
  })

  it('should refetch config when refetch is called', async () => {
    const initialConfig = TestDataFactory.createUser({
      id: 'test-ai-config-id',
      assistant_name: 'Initial Assistant',
      greeting_message: 'Hello!',
      business_hours: { '9-17': true },
      services: ['customer_support'],
      vapi_agent_id: 'test-vapi-agent-id',
      vapi_phone_number: '+1234567890'
    })

    const updatedConfig = {
      ...initialConfig,
      assistant_name: 'Updated Assistant',
      greeting_message: 'Hi there!'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: initialConfig }),
    } as Response)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: updatedConfig }),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toEqual(initialConfig)
    })

    // Call refetch
    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.config).toEqual(updatedConfig)
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should handle network errors gracefully', async () => {
    // Mock network error
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch')
    expect(result.current.config).toBe(null)
  })

  it('should handle malformed JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as Response)

    const { result } = renderHook(() => useAIAssistant())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Unexpected token')
    expect(result.current.config).toBe(null)
  })
})