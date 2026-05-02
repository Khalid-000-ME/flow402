import { NextResponse } from 'next/server'
import { runInference } from '@/lib/0g/compute'

export async function POST(req: Request) {
  const { provider, messages, systemPrompt } = await req.json()

  if (!provider || !messages) {
    return NextResponse.json({ error: 'provider and messages are required' }, { status: 400 })
  }

  try {
    const result = await runInference(provider, messages, systemPrompt || '')
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
