import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/provider-store'
import { testProviderConnection } from '@/lib/provider-runtime'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/providers/:id/test - Test provider connection
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const provider = getProvider(id)

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Test the connection
    const result = await testProviderConnection(provider)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to test provider:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      },
      { status: 500 }
    )
  }
}
