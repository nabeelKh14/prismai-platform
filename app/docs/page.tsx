'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import 'swagger-ui-react/swagger-ui.css'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null)

  useEffect(() => {
    // Fetch the OpenAPI spec
    fetch('/api/docs')
      .then(res => res.json())
      .then(setSpec)
      .catch(console.error)
  }, [])

  if (!spec) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading API documentation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">PrismAI API Documentation</h1>
          <p className="text-muted-foreground">
            Interactive API documentation for the PrismAI platform.
            Explore endpoints, test requests, and integrate with our services.
          </p>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          <SwaggerUI
            spec={spec}
            tryItOutEnabled={true}
            requestInterceptor={(req: any) => {
              // Add API key if available in localStorage
              const apiKey = localStorage.getItem('api_key')
              if (apiKey) {
                req.headers['x-api-key'] = apiKey
              }
              return req
            }}
            responseInterceptor={(res: any) => {
              // Store API key from responses if provided
              const apiKey = res.headers?.['x-api-key']
              if (apiKey) {
                localStorage.setItem('api_key', apiKey)
              }
              return res
            }}
            docExpansion="list"
            defaultModelsExpandDepth={-1}
            defaultModelExpandDepth={1}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
          />
        </div>
      </div>
    </div>
  )
}