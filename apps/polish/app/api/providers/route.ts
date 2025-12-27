import { NextRequest, NextResponse } from 'next/server'
import {
  createProvider,
  getAllProvidersMasked,
  hasProviders
} from '@/lib/provider-store'
import type { CreateProviderRequest, ProviderType } from '@/lib/types'

// GET /api/providers - List all providers (with masked API keys)
export async function GET() {
  try {
    const providers = getAllProvidersMasked()
    return NextResponse.json({
      providers,
      hasProviders: hasProviders()
    })
  } catch (error) {
    console.error('Failed to get providers:', error)
    return NextResponse.json(
      { error: 'Failed to get providers' },
      { status: 500 }
    )
  }
}

// POST /api/providers - Create a new provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateProviderRequest

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Provider name is required' },
        { status: 400 }
      )
    }

    if (!body.type || !isValidProviderType(body.type)) {
      return NextResponse.json(
        { error: 'Valid provider type is required (anthropic, anthropic_oauth, openrouter, glm, openai_compatible)' },
        { status: 400 }
      )
    }

    if (!body.apiKey || typeof body.apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // For openai_compatible, baseUrl is required
    if (body.type === 'openai_compatible' && !body.baseUrl) {
      return NextResponse.json(
        { error: 'Base URL is required for OpenAI-compatible providers' },
        { status: 400 }
      )
    }

    // Create the provider
    const provider = createProvider({
      name: body.name.trim(),
      type: body.type,
      baseUrl: body.baseUrl?.trim() || undefined,
      apiKey: body.apiKey.trim(),
      isDefault: body.isDefault
    })

    // Return with masked API key
    return NextResponse.json({
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        baseUrl: provider.baseUrl,
        apiKeyMasked: maskApiKey(provider.apiKey),
        isDefault: provider.isDefault,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create provider:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create provider' },
      { status: 500 }
    )
  }
}

// Helper functions
function isValidProviderType(type: string): type is ProviderType {
  return ['anthropic', 'anthropic_oauth', 'openrouter', 'glm', 'openai_compatible'].includes(type)
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***'
  }
  const prefix = apiKey.slice(0, 3)
  const suffix = apiKey.slice(-4)
  return `${prefix}...${suffix}`
}
