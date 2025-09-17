import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withErrorHandling, ValidationError } from "@/lib/errors"

interface ImportResult {
  success: boolean
  imported: number
  errors: number
  errorDetails: string[]
}

// Helper function to parse CSV
function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1)

  return rows.map(row => {
    const values = row.split(',').map(v => v.trim().replace(/"/g, ''))
    const obj: any = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })
    return obj
  })
}

// Helper function to parse JSON
function parseJSON(jsonText: string): any[] {
  try {
    const data = JSON.parse(jsonText)
    return Array.isArray(data) ? data : [data]
  } catch (error) {
    throw new Error('Invalid JSON format')
  }
}

// Helper function to parse text files (simple format)
function parseText(textContent: string): any[] {
  const articles = textContent.split('---').filter(block => block.trim())

  return articles.map(block => {
    const lines = block.trim().split('\n')
    const title = lines[0]?.replace(/^#\s*/, '').trim() || 'Untitled'
    const content = lines.slice(1).join('\n').trim()

    return {
      title,
      content,
      category: '',
      tags: [],
      is_published: false
    }
  })
}

// Validate and normalize article data
function validateArticle(article: any): { isValid: boolean; data?: any; error?: string } {
  if (!article.title || typeof article.title !== 'string' || article.title.length > 200) {
    return { isValid: false, error: 'Invalid or missing title' }
  }

  if (!article.content || typeof article.content !== 'string' || article.content.length > 10000) {
    return { isValid: false, error: 'Invalid or missing content' }
  }

  return {
    isValid: true,
    data: {
      title: article.title,
      content: article.content,
      category: article.category || null,
      tags: Array.isArray(article.tags) ? article.tags : [],
      is_published: Boolean(article.is_published)
    }
  }
}

// POST: Import knowledge base articles
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const formData = await request.formData()

  const file = formData.get('file') as File
  if (!file) {
    throw new ValidationError('No file provided')
  }

  const fileContent = await file.text()
  let articles: any[] = []

  // Parse file based on type
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.csv')) {
    articles = parseCSV(fileContent)
  } else if (fileName.endsWith('.json')) {
    articles = parseJSON(fileContent)
  } else if (fileName.endsWith('.txt')) {
    articles = parseText(fileContent)
  } else {
    throw new ValidationError('Unsupported file type. Please upload CSV, JSON, or TXT files.')
  }

  if (articles.length === 0) {
    throw new ValidationError('No articles found in the uploaded file')
  }

  const result: ImportResult = {
    success: true,
    imported: 0,
    errors: 0,
    errorDetails: []
  }

  // Process articles in batches to avoid overwhelming the database
  const batchSize = 10
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize)
    const validArticles: any[] = []

    // Validate batch
    batch.forEach((article, index) => {
      const validation = validateArticle(article)
      if (validation.isValid) {
        validArticles.push(validation.data)
      } else {
        result.errors++
        result.errorDetails.push(`Row ${i + index + 1}: ${validation.error}`)
      }
    })

    // Insert valid articles
    if (validArticles.length > 0) {
      const { data, error } = await supabase
        .from('knowledge_base')
        .insert(validArticles)
        .select()

      if (error) {
        result.errors += validArticles.length
        result.errorDetails.push(`Batch insert failed: ${error.message}`)
      } else {
        result.imported += data?.length || 0

        // Generate embeddings for new articles
        for (const article of data || []) {
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
            console.warn(`Failed to generate embedding for article ${article.id}:`, embeddingError)
          }
        }
      }
    }
  }

  return NextResponse.json(result)
})