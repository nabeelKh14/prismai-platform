import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiKeyManager } from '@/lib/rate-limit/api-keys'
import { z } from 'zod'
import { withErrorHandling, ValidationError } from '@/lib/errors'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['free', 'pro', 'enterprise']).default('free'),
})

/**
 * @swagger
 * /api/developer/api-keys:
 *   get:
 *     summary: Get user's API keys
 *     description: Retrieve all API keys for the authenticated user
 *     tags:
 *       - Developer Portal
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: API keys retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       key:
 *                         type: string
 *                         description: Masked API key
 *                       tier:
 *                         type: string
 *                         enum: [free, starter, professional, enterprise]
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastUsedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create new API key
 *     description: Generate a new API key for the authenticated user
 *     tags:
 *       - Developer Portal
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Human-readable name for the API key
 *               tier:
 *                 type: string
 *                 enum: [free, starter, professional, enterprise]
 *                 default: free
 *                 description: API key tier determining rate limits
 *     responses:
 *       200:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 key:
 *                   type: object
 *                   description: Created API key object
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's API keys
  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch API keys: ${error.message}`)
  }

  // Format response
  const formattedKeys = keys?.map(key => ({
    id: key.id,
    name: key.metadata?.name || `API Key ${key.id.substring(0, 8)}`,
    key: key.key_hash, // Don't return actual key, just hash for display
    tier: key.tier,
    isActive: key.is_active,
    createdAt: key.created_at,
    lastUsedAt: key.last_used_at,
    expiresAt: key.expires_at,
  })) || []

  return NextResponse.json({
    success: true,
    keys: formattedKeys
  })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const body = await request.json()
  const validatedData = createApiKeySchema.parse(body)

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create API key using the manager
  const apiKey = await ApiKeyManager.createApiKey(user.id, validatedData.tier as 'free' | 'pro' | 'enterprise')

  // Update the metadata with the name
  const supabaseClient = await createClient()
  await supabaseClient
    .from('api_keys')
    .update({
      metadata: { name: validatedData.name }
    })
    .eq('id', apiKey.id)

  return NextResponse.json({
    success: true,
    key: {
      id: apiKey.id,
      name: validatedData.name,
      key: apiKey.key, // Return the actual key only on creation
      tier: apiKey.tier,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
    }
  })
})