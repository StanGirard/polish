import { NextRequest, NextResponse } from 'next/server'
import {
  getMcpServerPublic,
  updateMcpServer,
  deleteMcpServer
} from '@/lib/mcp-store'
import type { UpdateMcpServerRequest } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/mcp-servers/:id
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const server = getMcpServerPublic(id)

    if (!server) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ server })
  } catch (error) {
    console.error('Failed to get MCP server:', error)
    return NextResponse.json(
      { error: 'Failed to get MCP server' },
      { status: 500 }
    )
  }
}

// PUT /api/mcp-servers/:id
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json() as UpdateMcpServerRequest

    const existing = getMcpServerPublic(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Validate updates
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return NextResponse.json(
        { error: 'Server name cannot be empty' },
        { status: 400 }
      )
    }

    updateMcpServer(id, {
      name: body.name?.trim(),
      command: body.command?.trim(),
      args: body.args,
      env: body.env,
      url: body.url?.trim(),
      headers: body.headers,
      isEnabled: body.isEnabled
    })

    const updated = getMcpServerPublic(id)
    return NextResponse.json({ server: updated })
  } catch (error) {
    console.error('Failed to update MCP server:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update MCP server' },
      { status: 500 }
    )
  }
}

// DELETE /api/mcp-servers/:id
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const result = deleteMcpServer(id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'MCP server not found' ? 404 : 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete MCP server:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete MCP server' },
      { status: 500 }
    )
  }
}
