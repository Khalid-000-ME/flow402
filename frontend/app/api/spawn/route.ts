import { NextRequest } from 'next/server'
import { orchestrate } from '@/lib/orchestrator'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()

  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400 })
  }

  const runId = crypto.randomUUID()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: string, data: object) {
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(new TextEncoder().encode(chunk))
      }

      try {
        emit('run_started', { runId, timestamp: Date.now() })
        await orchestrate(prompt, runId, emit)
      } catch (err) {
        emit('run_error', { error: String(err), timestamp: Date.now() })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
