import { NextResponse } from 'next/server'
import { getAllBranches, getCurrentBranch } from '@/lib/git'

// GET /api/branches - List all git branches
export async function GET() {
  try {
    const projectPath = process.cwd()
    const branches = await getAllBranches(projectPath)
    const currentBranch = await getCurrentBranch(projectPath)

    return NextResponse.json({
      branches,
      currentBranch
    })
  } catch (error) {
    console.error('Failed to get branches:', error)
    return NextResponse.json(
      { error: 'Failed to get branches' },
      { status: 500 }
    )
  }
}
