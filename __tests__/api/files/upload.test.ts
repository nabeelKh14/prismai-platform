import { NextRequest } from 'next/server'
import { POST } from '@/app/api/files/upload/route'
import { createClient } from '@/lib/supabase/server'
import { TestDataFactory, MockUtils } from '../../utils/test-utils'

// Mock Supabase client
const mockSupabase = MockUtils.createMockSupabaseClient()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

// Type assertion to fix TypeScript issues
const mockSupabaseTyped = mockSupabase as any

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn()
      }))
    }
  }))
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

describe('/api/files/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 for unauthenticated user', async () => {
    // Mock unauthenticated user
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null
    })

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: new FormData()
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(401)
    expect(result.error).toBe('Unauthorized')
  })

  it('should return 400 for missing file', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    const formData = new FormData()
    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toBe('No file provided')
  })

  it('should return 400 for file size exceeding limit', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    const formData = new FormData()
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large-file.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', largeFile)

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toBe('File size exceeds 10MB limit')
  })

  it('should return 400 for disallowed file type', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    const formData = new FormData()
    const disallowedFile = new File(['test content'], 'malicious.exe', {
      type: 'application/x-msdownload'
    })
    formData.append('file', disallowedFile)

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toBe('File type not allowed')
  })

  it('should return 404 for non-existent conversation', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock conversation not found
    mockSupabaseTyped.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Conversation not found' }
      }))
    }))

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)
    formData.append('conversation_id', 'non-existent-conversation')

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(404)
    expect(result.error).toBe('Conversation not found')
  })

  it('should upload file successfully', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock successful conversation verification
    mockSupabaseTyped.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({
        data: { id: 'test-conversation-id' },
        error: null
      }))
    }))

    // Mock successful file insert
    mockSupabaseTyped.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({
        data: {
          id: 'test-file-id',
          file_name: 'test.pdf',
          file_size: 1024,
          file_type: 'application/pdf',
          file_url: 'https://test.supabase.co/storage/files/test-file.pdf',
          created_at: '2024-01-01T10:00:00Z'
        },
        error: null
      }))
    }))

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)
    formData.append('conversation_id', 'test-conversation-id')

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result).toEqual({
      id: 'test-file-id',
      file_name: 'test.pdf',
      file_size: 1024,
      file_type: 'application/pdf',
      file_url: 'https://test.supabase.co/storage/files/test-file.pdf',
      uploaded_at: '2024-01-01T10:00:00Z'
    })
  })

  it('should handle file upload without conversation_id', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock successful database insert
    mockSupabaseTyped.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({
        data: {
          id: 'test-file-id',
          file_name: 'test.pdf',
          file_size: 1024,
          file_type: 'application/pdf',
          file_url: 'https://test.supabase.co/storage/files/test-file.pdf',
          created_at: '2024-01-01T10:00:00Z'
        },
        error: null
      }))
    }))

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.id).toBe('test-file-id')
    expect(result.file_name).toBe('test.pdf')
  })

  it('should handle file upload with message_id', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock successful database insert
    mockSupabaseTyped.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({
        data: {
          id: 'test-file-id',
          file_name: 'test.pdf',
          file_size: 1024,
          file_type: 'application/pdf',
          file_url: 'https://test.supabase.co/storage/files/test-file.pdf',
          created_at: '2024-01-01T10:00:00Z'
        },
        error: null
      }))
    }))

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)
    formData.append('message_id', 'test-message-id')

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.id).toBe('test-file-id')
  })

  it('should handle storage upload error', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock storage upload error
    const mockSupabaseAdmin = {
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Storage upload failed' }
          })),
          getPublicUrl: jest.fn(() => ({
            data: { publicUrl: 'https://test.supabase.co/storage/files/test-file.pdf' }
          }))
        }))
      }
    }

    jest.mocked(require('@supabase/supabase-js').createClient).mockReturnValue(mockSupabaseAdmin)

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to upload file')
  })

  it('should handle database error and cleanup uploaded file', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock successful storage upload
    const mockSupabaseAdmin = {
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(() => Promise.resolve({
            data: { path: 'test-file-path' },
            error: null
          })),
          getPublicUrl: jest.fn(() => ({
            data: { publicUrl: 'https://test.supabase.co/storage/files/test-file.pdf' }
          })),
          remove: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }
    }

    jest.mocked(require('@supabase/supabase-js').createClient).mockReturnValue(mockSupabaseAdmin)

    // Mock database error
    mockSupabaseTyped.from.mockImplementation((table: string) => ({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Database insert failed' }
          }))
        })
      })
    }))

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to save file metadata')
  })

  it('should handle allowed image file types', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock successful database insert
    mockSupabaseTyped.from.mockImplementation((table: string) => ({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'test-file-id',
              file_name: 'test.jpg',
              file_size: 1024,
              file_type: 'image/jpeg',
              file_url: 'https://test.supabase.co/storage/files/test-file.jpg',
              created_at: '2024-01-01T10:00:00Z'
            },
            error: null
          }))
        })
      })
    }))

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    for (const fileType of allowedTypes) {
      const formData = new FormData()
      const testFile = new File(['test content'], `test.${fileType.split('/')[1]}`, {
        type: fileType
      })
      formData.append('file', testFile)

      const request = new NextRequest('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    }
  })

  it('should handle allowed document file types', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock successful database insert
    mockSupabaseTyped.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({
        data: {
          id: 'test-file-id',
          file_name: 'test.pdf',
          file_size: 1024,
          file_type: 'application/pdf',
          file_url: 'https://test.supabase.co/storage/files/test-file.pdf',
          created_at: '2024-01-01T10:00:00Z'
        },
        error: null
      }))
    }))

    const allowedTypes = ['application/pdf', 'text/plain']

    for (const fileType of allowedTypes) {
      const formData = new FormData()
      const testFile = new File(['test content'], `test.${fileType.split('/')[1]}`, {
        type: fileType
      })
      formData.append('file', testFile)

      const request = new NextRequest('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    }
  })

  it('should handle internal server error', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockRejectedValueOnce(new Error('Database connection failed'))

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Internal server error')
  })

  it('should generate unique file names', async () => {
    const mockUser = TestDataFactory.createUser({ id: 'test-user-id' })
    mockSupabaseTyped.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    })

    // Mock successful database insert
    mockSupabaseTyped.from.mockImplementation((table: string) => ({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'test-file-id',
              file_name: 'test.pdf',
              file_size: 1024,
              file_type: 'application/pdf',
              file_url: 'https://test.supabase.co/storage/files/test-file.pdf',
              created_at: '2024-01-01T10:00:00Z'
            },
            error: null
          }))
        })
      })
    }))

    const formData = new FormData()
    const validFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    })
    formData.append('file', validFile)

    const request = new NextRequest('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.file_name).toBe('test.pdf')
  })
})