/**
 * POST /api/execute-swap
 *
 * Manually triggered by the user from the Studio UI after agent analysis.
 * Executes a token swap on behalf of the orchestrator wallet using the
 * Uniswap Trade API.
 *
 * Body:
 *   tokenIn   — symbol ('ETH') or address (default: 'ETH')
 *   tokenOut  — symbol ('USDC', 'DAI', 'WETH') or address
 *   amountIn  — human-readable amount of tokenIn (e.g. '0.0001')
 *   chainId   — optional, default from SWAP_CHAIN_ID env (default: 11155111 Sepolia)
 *   slippage  — optional percent (default 0.5)
 */

import { NextResponse } from 'next/server'
import { executeSwap }  from '@/lib/orchestrator/swap'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      tokenIn?:  string
      tokenOut?: string
      amountIn?: string
      chainId?:  number
      slippage?: number
    }

    const { tokenIn = 'ETH', tokenOut, amountIn, chainId, slippage } = body

    if (!tokenOut)  return NextResponse.json({ error: 'tokenOut is required' },  { status: 400 })
    if (!amountIn)  return NextResponse.json({ error: 'amountIn is required' },  { status: 400 })
    if (!process.env.UNISWAP_API_KEY) {
      return NextResponse.json({ error: 'UNISWAP_API_KEY not configured on server' }, { status: 500 })
    }
    if (!process.env.ZG_PRIVATE_KEY) {
      return NextResponse.json({ error: 'ZG_PRIVATE_KEY not configured on server' }, { status: 500 })
    }

    const result = await executeSwap({ tokenIn, tokenOut, amountIn, chainId, slippage })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
