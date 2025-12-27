import { NextRequest, NextResponse } from 'next/server'
import { getMcpServer } from '@/lib/mcp-store'
import { testMcpConnection } from '@/lib/mcp-runtime'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/mcp-servers/:id/test - Test MCP server connection
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const server = getMcpServer(id)

    if (!server) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    const result = await testMcpConnection(server)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to test MCP server:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      },
      { status: 500 }
    )
  }
}
