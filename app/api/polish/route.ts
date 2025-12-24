import { NextRequest } from 'next/server'
import { clone, createTempDir, cleanupTempDir } from '@/lib/git'
import { runPolishAgent, PolishEvent } from '@/lib/agent'
import { exec } from '@/lib/executor'

export const maxDuration = 300 // 5 min max (Vercel limit)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { repoUrl, maxTurns = 20 } = body

  // Validate repo URL
  if (!repoUrl || typeof repoUrl !== 'string') {
    return Response.json({ error: 'repoUrl is required' }, { status: 400 })
  }

  if (!repoUrl.startsWith('https://github.com/')) {
    return Response.json(
      { error: 'Only GitHub repositories are supported' },
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()
  const tempDir = createTempDir()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PolishEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      try {
        // Phase 1: Clone
        send({
          type: 'status',
          data: { phase: 'clone', message: `Cloning ${repoUrl}...` }
        })

        await clone(repoUrl, tempDir, process.env.GITHUB_TOKEN)

        send({
          type: 'status',
          data: { phase: 'clone', message: 'Clone complete' }
        })

        // Phase 2: Install dependencies
        send({
          type: 'status',
          data: { phase: 'install', message: 'Installing dependencies...' }
        })

        const installResult = await exec('npm install', tempDir, 120000)
        if (installResult.exitCode !== 0) {
          send({
            type: 'status',
            data: {
              phase: 'install',
              message: 'npm install completed with warnings',
              stderr: installResult.stderr.slice(0, 500)
            }
          })
        } else {
          send({
            type: 'status',
            data: { phase: 'install', message: 'Dependencies installed' }
          })
        }

        // Phase 3: Run polish agent
        send({
          type: 'status',
          data: { phase: 'polish', message: 'Starting polish agent...' }
        })

        for await (const event of runPolishAgent(tempDir, maxTurns)) {
          send(event)
        }

        // Done
        send({
          type: 'status',
          data: { phase: 'complete', message: 'Polish complete!' }
        })

      } catch (error) {
        send({
          type: 'error',
          data: {
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      } finally {
        // Cleanup
        await cleanupTempDir(tempDir)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
