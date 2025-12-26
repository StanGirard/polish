import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Allowed origins for CORS (frontend hosts that can access this backend)
const ALLOWED_ORIGINS = [
  'https://polish.run',
  'https://www.polish.run',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')

  // Only apply CORS to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check if origin is allowed
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Add CORS headers to all API responses
  const response = NextResponse.next()

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
