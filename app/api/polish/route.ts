import { NextRequest } from 'next/server'
import { runIsolatedPolish } from '@/lib/loop'
import type { PolishConfig, PolishEvent } from '@/lib/types'

export const maxDuration = 300 // 5 min max (Vercel limit)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    projectPath = process.cwd(),
    mission,
    polishOnly = false,
    maxDuration: duration = 5 * 60 * 1000 // 5 min default for web UI
  } = body

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PolishEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      try {
        const hasMission = mission && mission.trim() && !polishOnly

        send({
          type: 'status',
          data: {
            phase: 'starting',
            message: hasMission
              ? `Starting Polish with mission on ${projectPath}...`
              : `Starting Polish on ${projectPath}...`
          }
        })

        const config: PolishConfig = {
          projectPath,
          mission: hasMission ? mission : undefined,
          maxDuration: duration,
          isolation: { enabled: true }
        }

        // Use runIsolatedPolish - handles both mission and polish-only cases
        for await (const event of runIsolatedPolish(config)) {
          send(event)
        }

        send({
          type: 'status',
          data: {
            phase: 'complete',
            message: 'Polish complete!'
          }
        })
      } catch (error) {
        send({
          type: 'error',
          data: {
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
}
