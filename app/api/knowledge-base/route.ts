import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError } from "@/lib/errors"

// Validation schemas
const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(10000),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().default(false)
})

const updateArticleSchema = createArticleSchema.partial()

/**
 * @swagger
 * /api/knowledge-base:
 *   get:
 *     summary: Get knowledge base articles
 *     description: Retrieve knowledge base articles with optional filtering and search
 *     tags:
 *       - Knowledge Base
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [published, draft]
 *         description: Filter by publication status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query for full-text search
 *     responses:
 *       200:
 *         description: Knowledge base articles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     articles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           content:
 *                             type: string
 *                           category:
 *                             type: string
 *                             nullable: true
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                           is_published:
 *                             type: boolean
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create knowledge base article
 *     description: Create a new knowledge base article
 *     tags:
 *       - Knowledge Base
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
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Article title
 *               content:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 10000
 *                 description: Article content
 *               category:
 *                 type: string
 *                 description: Article category
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Article tags
 *               is_published:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the article is published
 *     responses:
 *       200:
 *         description: Article created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     article:
 *                       type: object
 *                       description: Created article object
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
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const supabase = await createClient()

  let query = supabase
    .from('knowledge_base')
    .select('*')
    .order('updated_at', { ascending: false })

  // Apply filters
  const category = searchParams.get('category')
  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const status = searchParams.get('status')
  if (status === 'published') {
    query = query.eq('is_published', true)
  } else if (status === 'draft') {
    query = query.eq('is_published', false)
  }

  const search = searchParams.get('search')
  if (search) {
    // Use full-text search
    query = query.textSearch('search_vector', search)
  }

  const { data: articles, error } = await query

  if (error) {
    throw new Error(`Failed to fetch articles: ${error.message}`)
  }

  return NextResponse.json({
    success: true,
    articles: articles || []
  })
})

// POST: Create new knowledge base article
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const body = await request.json()
  const validatedData = createArticleSchema.parse(body)

  const { data: article, error } = await supabase
    .from('knowledge_base')
    .insert({
      title: validatedData.title,
      content: validatedData.content,
      category: validatedData.category || null,
      tags: validatedData.tags || [],
      is_published: validatedData.is_published
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create article: ${error.message}`)
  }

  // Generate embedding for the new article
  try {
    const fullContent = `${validatedData.title} ${validatedData.content}`
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: fullContent,
        articleId: article.id
      })
    })
  } catch (embeddingError) {
    console.warn('Failed to generate embedding for new article:', embeddingError)
    // Don't fail the request if embedding generation fails
  }

  return NextResponse.json({
    success: true,
    article
  })
})