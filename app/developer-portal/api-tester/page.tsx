'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play, Copy, Check, X, Loader2 } from 'lucide-react'
import DotGrid from '@/components/DotGrid'
import { toast } from 'sonner'

interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
  responseTime: number
}

const commonEndpoints = [
  { method: 'GET', path: '/api/health', description: 'Health check' },
  { method: 'GET', path: '/api/v1/health', description: 'Health check (v1)' },
  { method: 'GET', path: '/api/v2/health', description: 'Health check (v2 - deprecated)' },
  { method: 'POST', path: '/api/ai/embeddings', description: 'Generate embeddings' },
  { method: 'GET', path: '/api/ai/embeddings', description: 'Search knowledge base' },
  { method: 'GET', path: '/api/knowledge-base', description: 'Get knowledge base articles' },
  { method: 'POST', path: '/api/knowledge-base', description: 'Create knowledge base article' },
]

export default function ApiTesterPage() {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('/api/health')
  const [headers, setHeaders] = useState('{\n  "x-api-key": "YOUR_API_KEY"\n}')
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)

  const handleTest = async () => {
    setLoading(true)
    setResponse(null)

    try {
      const startTime = Date.now()

      // Parse headers
      let parsedHeaders = {}
      try {
        parsedHeaders = JSON.parse(headers)
      } catch (e) {
        toast.error('Invalid JSON in headers')
        setLoading(false)
        return
      }

      // Make the request
      const requestOptions: RequestInit = {
        method,
        headers: parsedHeaders as Record<string, string>,
      }

      if (method !== 'GET' && method !== 'HEAD' && body.trim()) {
        requestOptions.body = body
      }

      const res = await fetch(url, requestOptions)
      const endTime = Date.now()

      // Get response data
      let responseData
      const contentType = res.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        responseData = await res.json()
      } else {
        responseData = await res.text()
      }

      // Extract headers
      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const apiResponse: ApiResponse = {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        data: responseData,
        responseTime: endTime - startTime,
      }

      setResponse(apiResponse)

      if (res.ok) {
        toast.success(`Request successful (${res.status})`)
      } else {
        toast.error(`Request failed (${res.status})`)
      }
    } catch (error) {
      toast.error('Request failed: ' + (error as Error).message)
      setResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        data: { error: (error as Error).message },
        responseTime: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2))
      setCopiedResponse(true)
      toast.success('Response copied to clipboard')
      setTimeout(() => setCopiedResponse(false), 2000)
    }
  }

  const loadEndpoint = (endpoint: typeof commonEndpoints[0]) => {
    setMethod(endpoint.method)
    setUrl(endpoint.path)

    // Set appropriate headers and body based on endpoint
    if (endpoint.path.includes('/ai/embeddings') && endpoint.method === 'POST') {
      setHeaders('{\n  "Content-Type": "application/json",\n  "x-api-key": "YOUR_API_KEY"\n}')
      setBody('{\n  "text": "Your text to embed",\n  "articleId": "optional-article-uuid"\n}')
    } else if (endpoint.path.includes('/ai/embeddings') && endpoint.method === 'GET') {
      setHeaders('{\n  "x-api-key": "YOUR_API_KEY"\n}')
      setBody('')
    } else if (endpoint.path.includes('/knowledge-base') && endpoint.method === 'POST') {
      setHeaders('{\n  "Content-Type": "application/json",\n  "x-api-key": "YOUR_API_KEY"\n}')
      setBody('{\n  "title": "Article Title",\n  "content": "Article content..."\n}')
    } else {
      setHeaders('{\n  "x-api-key": "YOUR_API_KEY"\n}')
      setBody('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Interactive dot-grid background */}
      <DotGrid
        dotSize={2}
        gap={24}
        baseColor="#00ffff"
        activeColor="#ffffff"
        proximity={120}
        speedTrigger={50}
        shockRadius={200}
        shockStrength={3}
        className="fixed inset-0 z-0"
        style={{ opacity: 0.6 }}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Tester</h1>
          <p className="text-muted-foreground">Test API endpoints directly from your browser</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Common Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Common Endpoints</CardTitle>
            <CardDescription>Quick access to frequently used endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {commonEndpoints.map((endpoint, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start h-auto p-3"
                onClick={() => loadEndpoint(endpoint)}
              >
                <div className="flex items-center space-x-2 w-full">
                  <Badge variant={endpoint.method === 'GET' ? 'default' : 'secondary'}>
                    {endpoint.method}
                  </Badge>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{endpoint.path}</div>
                    <div className="text-xs text-muted-foreground">{endpoint.description}</div>
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Request Builder */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="API endpoint URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleTest} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Test
                </Button>
              </div>

              <Tabs defaultValue="headers" className="w-full">
                <TabsList>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="body" disabled={method === 'GET' || method === 'HEAD'}>
                    Body
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="headers" className="space-y-2">
                  <Label htmlFor="headers">Request Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="body" className="space-y-2">
                  <Label htmlFor="body">Request Body</Label>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    placeholder="Request body (JSON, text, etc.)"
                    className="font-mono text-sm"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Response */}
          {response && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Response</CardTitle>
                  <Button variant="outline" size="sm" onClick={copyResponse}>
                    {copiedResponse ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {response.status >= 200 && response.status < 300 ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                    <Badge variant={response.status >= 200 && response.status < 300 ? 'default' : 'destructive'}>
                      {response.status} {response.statusText}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {response.responseTime}ms
                  </div>
                </div>

                <Tabs defaultValue="body" className="w-full">
                  <TabsList>
                    <TabsTrigger value="body">Response Body</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                  </TabsList>

                  <TabsContent value="body">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto max-h-96">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  </TabsContent>

                  <TabsContent value="headers">
                    <div className="bg-muted p-4 rounded-lg text-sm font-mono">
                      {Object.entries(response.headers).map(([key, value]) => (
                        <div key={key} className="py-1">
                          <span className="font-semibold">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Alert>
        <Play className="h-4 w-4" />
        <AlertDescription>
          This API tester runs requests from your browser. Make sure CORS is properly configured
          and that you're using valid API keys. Some endpoints may require authentication.
        </AlertDescription>
      </Alert>
    </div>
  )
}