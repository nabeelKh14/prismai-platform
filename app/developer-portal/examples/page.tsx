'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check } from 'lucide-react'
import DotGrid from '@/components/DotGrid'
import { toast } from 'sonner'

const examples = {
  'health-check': {
    title: 'Health Check',
    description: 'Check API status and service health',
    endpoint: 'GET /api/health',
    curl: `curl -X GET "https://api.aibusinesssuite.com/api/health" \\
  -H "x-api-key: YOUR_API_KEY"`,
    javascript: `// Using fetch
const response = await fetch('/api/health', {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});

const health = await response.json();
console.log('API Status:', health.status);`,
    python: `import requests

# Using requests library
response = requests.get('/api/health', headers={
    'x-api-key': 'YOUR_API_KEY'
})

health = response.json()
print(f"API Status: {health['status']}")`,
    go: `package main

import (
    "fmt"
    "net/http"
    "io/ioutil"
)

func main() {
    client := &http.Client{}
    req, err := http.NewRequest("GET", "/api/health", nil)
    if err != nil {
        panic(err)
    }

    req.Header.Set("x-api-key", "YOUR_API_KEY")

    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        panic(err)
    }

    fmt.Println("Response:", string(body))
}`,
    csharp: `using System;
using System.Net.Http;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("x-api-key", "YOUR_API_KEY");

        var response = await client.GetAsync("/api/health");
        var content = await response.Content.ReadAsStringAsync();

        Console.WriteLine("Response: " + content);
    }
}`
  },
  'embeddings': {
    title: 'Generate Embeddings',
    description: 'Create vector embeddings for text using AI',
    endpoint: 'POST /api/ai/embeddings',
    curl: `curl -X POST "https://api.aibusinesssuite.com/api/ai/embeddings" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "text": "Your text to embed",
    "articleId": "optional-article-uuid"
  }'`,
    javascript: `// Generate embeddings
const response = await fetch('/api/ai/embeddings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    text: 'Your text to embed',
    articleId: 'optional-article-uuid' // optional
  })
});

const result = await response.json();
console.log('Embedding:', result.embedding);`,
    python: `import requests

# Generate embeddings
response = requests.post('/api/ai/embeddings',
    headers={
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_KEY'
    },
    json={
        'text': 'Your text to embed',
        'articleId': 'optional-article-uuid'  # optional
    }
)

result = response.json()
print(f"Embedding: {result['embedding']}")`,
    go: `package main

import (
    "bytes"
    "fmt"
    "net/http"
    "encoding/json"
)

type EmbeddingRequest struct {
    Text      string \`json:"text"\`
    ArticleID string \`json:"articleId,omitempty"\`
}

func main() {
    reqBody := EmbeddingRequest{
        Text:      "Your text to embed",
        ArticleID: "optional-article-uuid", // optional
    }

    jsonData, err := json.Marshal(reqBody)
    if err != nil {
        panic(err)
    }

    client := &http.Client{}
    req, err := http.NewRequest("POST", "/api/ai/embeddings", bytes.NewBuffer(jsonData))
    if err != nil {
        panic(err)
    }

    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("x-api-key", "YOUR_API_KEY")

    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    // Handle response...
}`,
    csharp: `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

class Program
{
    static async Task Main()
    {
        var requestData = new
        {
            text = "Your text to embed",
            articleId = "optional-article-uuid" // optional
        };

        var json = JsonConvert.SerializeObject(requestData);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("x-api-key", "YOUR_API_KEY");

        var response = await client.PostAsync("/api/ai/embeddings", content);
        var responseContent = await response.Content.ReadAsStringAsync();

        Console.WriteLine("Response: " + responseContent);
    }
}`
  },
  'knowledge-base': {
    title: 'Search Knowledge Base',
    description: 'Search articles using vector similarity',
    endpoint: 'GET /api/ai/embeddings',
    curl: `curl -X GET "https://api.aibusinesssuite.com/api/ai/embeddings?query=Your%20search%20query&limit=5" \\
  -H "x-api-key: YOUR_API_KEY"`,
    javascript: `// Search knowledge base
const response = await fetch('/api/ai/embeddings?query=Your%20search%20query&limit=5', {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});

const results = await response.json();
console.log('Search results:', results.results);`,
    python: `import requests

# Search knowledge base
response = requests.get('/api/ai/embeddings',
    params={
        'query': 'Your search query',
        'limit': 5
    },
    headers={
        'x-api-key': 'YOUR_API_KEY'
    }
)

results = response.json()
print(f"Search results: {results['results']}")`,
    go: `package main

import (
    "fmt"
    "net/http"
)

func main() {
    client := &http.Client{}
    req, err := http.NewRequest("GET", "/api/ai/embeddings?query=Your%20search%20query&limit=5", nil)
    if err != nil {
        panic(err)
    }

    req.Header.Set("x-api-key", "YOUR_API_KEY")

    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    // Handle response...
}`,
    csharp: `using System;
using System.Net.Http;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("x-api-key", "YOUR_API_KEY");

        var response = await client.GetAsync("/api/ai/embeddings?query=Your%20search%20query&limit=5");
        var content = await response.Content.ReadAsStringAsync();

        Console.WriteLine("Response: " + content);
    }
}`
  }
}

const languages = [
  { key: 'curl', label: 'cURL', icon: '🌀' },
  { key: 'javascript', label: 'JavaScript', icon: '🟨' },
  { key: 'python', label: 'Python', icon: '🐍' },
  { key: 'go', label: 'Go', icon: '🐹' },
  { key: 'csharp', label: 'C#', icon: '🔷' },
]

export default function ExamplesPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = async (code: string, key: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(key)
    toast.success('Code copied to clipboard')
    setTimeout(() => setCopiedCode(null), 2000)
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
          <h1 className="text-3xl font-bold">Code Examples</h1>
          <p className="text-muted-foreground">Get started quickly with code examples in multiple languages</p>
        </div>
      </div>

      <div className="grid gap-6">
        {Object.entries(examples).map(([key, example]) => (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{example.title}</CardTitle>
                  <CardDescription>{example.description}</CardDescription>
                </div>
                <Badge variant="outline">{example.endpoint}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="curl" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  {languages.map((lang) => (
                    <TabsTrigger key={lang.key} value={lang.key} className="text-xs">
                      {lang.icon} {lang.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {languages.map((lang) => (
                  <TabsContent key={lang.key} value={lang.key} className="mt-4">
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-8 w-8 p-0"
                        onClick={() => copyToClipboard(example[lang.key as keyof typeof example] as string, `${key}-${lang.key}`)}
                      >
                        {copiedCode === `${key}-${lang.key}` ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                        <code>{example[lang.key as keyof typeof example]}</code>
                      </pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <CardTitle className="text-lg">Need More Examples?</CardTitle>
          <CardDescription>
            Check out our comprehensive documentation and SDKs for more detailed examples and integrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button asChild>
              <a href="/docs" target="_blank" rel="noopener noreferrer">
                View Full Documentation
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://github.com/aibusinesssuite" target="_blank" rel="noopener noreferrer">
                GitHub Repository
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}