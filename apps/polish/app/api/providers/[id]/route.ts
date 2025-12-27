import { NextRequest, NextResponse } from 'next/server'
import {
  getProviderMasked,
  updateProvider,
  deleteProvider
} from '@/lib/provider-store'
import { maskApiKey } from '@/lib/provider-store'
import type { UpdateProviderRequest, ProviderType } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/providers/:id - Get a single provider (with masked API key)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const provider = getProviderMasked(id)

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ provider })
  } catch (error) {
    console.error('Failed to get provider:', error)
    return NextResponse.json(
      { error: 'Failed to get provider' },
      { status: 500 }
    )
  }
}

// PUT /api/providers/:id - Update a provider
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json() as UpdateProviderRequest

    // Check if provider exists
    const existing = getProviderMasked(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Validate updates
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return NextResponse.json(
        { error: 'Provider name cannot be empty' },
        { status: 400 }
      )
    }

    if (body.apiKey !== undefined && (typeof body.apiKey !== 'string' || !body.apiKey.trim())) {
      return NextResponse.json(
        { error: 'API key cannot be empty' },
        { status: 400 }
      )
    }

    // Update the provider
    updateProvider(id, {
      name: body.name?.trim(),
      baseUrl: body.baseUrl?.trim(),
      apiKey: body.apiKey?.trim(),
      isDefault: body.isDefault
    })

    // Get updated provider
    const updated = getProviderMasked(id)

    return NextResponse.json({ provider: updated })
  } catch (error) {
    console.error('Failed to update provider:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update provider' },
      { status: 500 }
    )
  }
}

// DELETE /api/providers/:id - Delete a provider
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const result = deleteProvider(id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Provider not found' ? 404 : 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete provider:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete provider' },
      { status: 500 }
    )
  }
}
