import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  console.log('Health check endpoint called at', new Date().toISOString())
  return new Response('API is working', { status: 200 })
}