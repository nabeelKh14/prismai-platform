import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError, NotFoundError } from "@/lib/errors"

const updateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(10).max(10000).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().optional()
})

// GET: Fetch single knowledge base article
export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const supabase = await createClient()
  const { id } = await params

  const { data: article, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Article not found')
    }
    throw new Error(`Failed to fetch article: ${error.message}`)
  }

  return NextResponse.json({
    success: true,
    article
  })
})

// PUT: Update knowledge base article
export const PUT = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()
  const validatedData = updateArticleSchema.parse(body)

  // First, get the current article to check if content changed
  const { data: currentArticle } = await supabase
    .from('knowledge_base')
    .select('title, content')
    .eq('id', id)
    .single()

  const { data: article, error } = await supabase
    .from('knowledge_base')
    .update({
      ...validatedData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Article not found')
    }
    throw new Error(`Failed to update article: ${error.message}`)
  }

  // Regenerate embedding if title or content changed
  const titleChanged = validatedData.title && validatedData.title !== currentArticle?.title
  const contentChanged = validatedData.content && validatedData.content !== currentArticle?.content

  if (titleChanged || contentChanged) {
    try {
      const fullContent = `${article.title} ${article.content}`
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
      console.warn('Failed to regenerate embedding for updated article:', embeddingError)
      // Don't fail the request if embedding regeneration fails
    }
  }

  return NextResponse.json({
    success: true,
    article
  })
})

// DELETE: Delete knowledge base article
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', id)

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Article not found')
    }
    throw new Error(`Failed to delete article: ${error.message}`)
  }

  return NextResponse.json({
    success: true,
    message: 'Article deleted successfully'
  })
})