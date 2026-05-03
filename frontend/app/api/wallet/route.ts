import { NextResponse } from 'next/server'
import { sendPayment, getOrchestratorBalance, transferToken } from '@/lib/orchestrator/wallet'

/**
 * GET /api/wallet
 * Returns the orchestrator wallet address and OG balance.
 */
export async function GET() {
  try {
    const info = await getOrchestratorBalance()
    return NextResponse.json(info)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

/**
 * POST /api/wallet/pay
 * Body: { to: string, amountOG: string, tokenAddress?: string }
 *
 * Sends OG (native) or ERC-20 tokens from the orchestrator wallet.
 * Used internally by the orchestrator for agent-initiated payments.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as { to?: string; amountOG?: string; tokenAddress?: string }
    const { to, amountOG, tokenAddress } = body

    if (!to || !amountOG) {
      return NextResponse.json({ error: 'to and amountOG are required' }, { status: 400 })
    }

    if (tokenAddress) {
      const result = await transferToken(tokenAddress, to, amountOG)
      return NextResponse.json(result)
    }

    const result = await sendPayment(to, amountOG)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
