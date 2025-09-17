import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"

// Validation schema
const generateEmbeddingSchema = z.object({
  text: z.string().min(1).max(10000),
  articleId: z.string().uuid().optional(), // If updating existing article
})

// Generate embeddings for text using Google Gemini
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await geminiClient.createEmbedding({ input: text })
    return response.embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
}

/**
 * @swagger
 * /api/ai/embeddings:
 *   post:
 *     summary: Generate text embeddings
 *     description: Generate vector embeddings for text using Google Gemini AI
 *     tags:
 *       - AI
 *       - Embeddings
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *                 description: Text to generate embedding for
 *               articleId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional article ID to update with embedding
 *     responses:
 *       200:
 *         description: Embedding generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     embedding:
 *                       type: array
 *                       items:
 *                         type: number
 *                       description: Vector embedding array
 *                     articleId:
 *                       type: string
 *                       format: uuid
 *                       description: Article ID if provided
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: Search knowledge base with embeddings
 *     description: Search knowledge base articles using vector similarity
 *     tags:
 *       - AI
 *       - Embeddings
 *       - Knowledge Base
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *           minimum: 1
 *           maximum: 50
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         description: Knowledge base article match
 *                     query:
 *                       type: string
 *                       description: Original search query
 *                     embedding:
 *                       type: array
 *                       items:
 *                         type: number
 *                       description: Query embedding vector
 *       400:
 *         description: Missing or invalid query parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const body = await request.json()
  const validatedData = generateEmbeddingSchema.parse(body)

  // Generate embedding
  const embedding = await generateEmbedding(validatedData.text)

  // If articleId provided, update the knowledge base article
  if (validatedData.articleId) {
    const { error: updateError } = await supabase
      .from('knowledge_base')
      .update({
        embedding: `[${embedding.join(',')}]`, // Store as PostgreSQL vector
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedData.articleId)

    if (updateError) {
      throw new Error(`Failed to update article embedding: ${updateError.message}`)
    }

    return NextResponse.json({
      success: true,
      embedding,
      articleId: validatedData.articleId
    })
  }

  // Return embedding for general use
  return NextResponse.json({
    success: true,
    embedding
  })
})

// GET: Search knowledge base using vector similarity
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  const limit = parseInt(searchParams.get('limit') || '5')

  if (!query) {
    throw new ValidationError('Query parameter is required')
  }

  const supabase = await createClient()

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Search using vector similarity
  const { data: results, error } = await supabase.rpc('search_knowledge_base_vector', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: 0.1,
    match_count: limit
  })

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`)
  }

  return NextResponse.json({
    success: true,
    results: results || [],
    query,
    embedding: queryEmbedding
  })
})