import { NextResponse } from 'next/server'
import { triggerRunCommitment } from '@/lib/keeperhub/mcp'

export async function POST(req: Request) {
  const { workflowId, params } = await req.json()

  try {
    const result = await triggerRunCommitment(params)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
