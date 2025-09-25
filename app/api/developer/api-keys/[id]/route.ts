import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiKeyManager } from '@/lib/rate-limit/api-keys'
import { withErrorHandling } from '@/lib/errors'

/**
 * @swagger
 * /api/developer/api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     description: Deactivate and delete an API key for the authenticated user
 *     tags:
 *       - Developer Portal
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: API key ID to delete
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: API key deleted successfully
 *       403:
 *         description: Forbidden - API key does not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: API key not found
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
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: keyId } = await context.params

  // Verify the API key belongs to the user
  const { data: apiKey, error: keyError } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('id', keyId)
    .single()

  if (keyError || !apiKey) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  }

  if (apiKey.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Deactivate the API key
  const success = await ApiKeyManager.deactivateApiKey(apiKey.id)

  if (!success) {
    throw new Error('Failed to delete API key')
  }

  return NextResponse.json({
    success: true,
    message: 'API key deleted successfully'
  })
})