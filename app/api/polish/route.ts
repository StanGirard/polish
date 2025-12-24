import { NextRequest, NextResponse } from 'next/server'
import { tasks, runs } from '@trigger.dev/sdk/v3'
import type { polishTask } from '@/trigger/polish'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { repoUrl, duration } = body

    // Validate repo URL
    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json(
        { error: 'repoUrl is required' },
        { status: 400 }
      )
    }

    // Validate it's a GitHub URL
    if (!repoUrl.startsWith('https://github.com/')) {
      return NextResponse.json(
        { error: 'Only GitHub repositories are supported' },
        { status: 400 }
      )
    }

    // Get GitHub token from environment
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      )
    }

    // Validate duration
    const validDuration = duration && typeof duration === 'number'
      ? Math.min(Math.max(duration, 1800), 7200) // 30min to 2h
      : 3600 // default 1h

    // Trigger the polish task
    const handle = await tasks.trigger<typeof polishTask>('polish-repo', {
      repoUrl,
      githubToken,
      duration: validDuration,
    })

    return NextResponse.json({ jobId: handle.id })
  } catch (error) {
    console.error('Failed to trigger polish task:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start polish job' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId is required' },
      { status: 400 }
    )
  }

  try {
    const run = await runs.retrieve(jobId)

    return NextResponse.json({
      id: run.id,
      status: run.status,
      output: run.output,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    })
  } catch (error) {
    console.error('Failed to retrieve job:', error)
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    )
  }
}
