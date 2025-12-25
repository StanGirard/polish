import { NextRequest } from 'next/server'
import {
  getSession,
  getLatestEvents,
  subscribeToSession
} from '@/lib/session-store'
import type { PolishEvent } from '@/lib/types'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/sessions/[id]/stream - SSE stream for session events
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params
  const session = getSession(id)

  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: PolishEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // Send existing events first
      const existingEvents = getLatestEvents(id, 200)
      for (const e of existingEvents) {
        try {
          const eventData = JSON.parse(e.data)
          send({ type: e.type, data: eventData } as PolishEvent)
        } catch (err) {
          console.warn(`[SSE] Skipping malformed event (id: ${e.id}, type: ${e.type}):`, err)
        }
      }

      // Send current session status
      controller.enqueue(encoder.encode(
        `event: session_status\ndata: ${JSON.stringify({
          id: session.id,
          status: session.status,
          branchName: session.branchName,
          initialScore: session.initialScore,
          finalScore: session.finalScore,
          commits: session.commits
        })}\n\n`
      ))

      // If session is already done, close stream
      // Keep stream open for: running, pending, planning, awaiting_approval
      if (session.status !== 'running' &&
          session.status !== 'pending' &&
          session.status !== 'planning' &&
          session.status !== 'awaiting_approval') {
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
        controller.close()
        return
      }

      // Subscribe to new events
      const unsubscribe = subscribeToSession(id, (event) => {
        try {
          send(event)

          // Close stream when session completes, fails, or is aborted
          if (event.type === 'result' || event.type === 'error' || event.type === 'aborted') {
            controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
            controller.close()
            unsubscribe()
          }
        } catch (err) {
          // Controller might be closed - log only if it's not a closed stream error
          if (err instanceof Error && !err.message.includes('closed')) {
            console.warn(`[SSE] Failed to send event (session: ${id}, type: ${event.type}):`, err)
          }
        }
      })

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive'
    }
  })
}
