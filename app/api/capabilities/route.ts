import { NextResponse } from 'next/server'
import { loadPreset } from '@/lib/scorer'
import { getAvailableCapabilities } from '@/lib/capabilities'

// GET /api/capabilities - Get available capabilities from current preset
export async function GET() {
  try {
    const projectPath = process.cwd()
    const preset = await loadPreset(projectPath)
    const capabilities = getAvailableCapabilities(preset)

    return NextResponse.json(capabilities)
  } catch (error) {
    console.error('Failed to get capabilities:', error)
    return NextResponse.json(
      { error: 'Failed to get capabilities', tools: [], mcpServers: [], plugins: [], agents: [] },
      { status: 500 }
    )
  }
}
