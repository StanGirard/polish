import { NextRequest, NextResponse } from 'next/server'
import {
  createMcpServer,
  getAllMcpServersPublic,
  hasMcpServers
} from '@/lib/mcp-store'
import type { CreateMcpServerRequest, McpServerType } from '@/lib/types'

// GET /api/mcp-servers - List all MCP servers
export async function GET() {
  try {
    const servers = getAllMcpServersPublic()
    return NextResponse.json({
      servers,
      hasMcpServers: hasMcpServers()
    })
  } catch (error) {
    console.error('Failed to get MCP servers:', error)
    return NextResponse.json(
      { error: 'Failed to get MCP servers' },
      { status: 500 }
    )
  }
}

// POST /api/mcp-servers - Create a new MCP server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateMcpServerRequest

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Server name is required' },
        { status: 400 }
      )
    }

    if (!body.type || !isValidMcpType(body.type)) {
      return NextResponse.json(
        { error: 'Valid server type is required (stdio, sse, http)' },
        { status: 400 }
      )
    }

    // Type-specific validation
    if (body.type === 'stdio') {
      if (!body.command || typeof body.command !== 'string') {
        return NextResponse.json(
          { error: 'Command is required for stdio servers' },
          { status: 400 }
        )
      }
    } else {
      if (!body.url || typeof body.url !== 'string') {
        return NextResponse.json(
          { error: 'URL is required for HTTP/SSE servers' },
          { status: 400 }
        )
      }
    }

    const server = createMcpServer({
      name: body.name.trim(),
      type: body.type,
      command: body.command?.trim(),
      args: body.args,
      env: body.env,
      url: body.url?.trim(),
      headers: body.headers,
      isEnabled: body.isEnabled
    })

    return NextResponse.json({ server }, { status: 201 })
  } catch (error) {
    console.error('Failed to create MCP server:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create MCP server' },
      { status: 500 }
    )
  }
}

function isValidMcpType(type: string): type is McpServerType {
  return ['stdio', 'sse', 'http'].includes(type)
}
