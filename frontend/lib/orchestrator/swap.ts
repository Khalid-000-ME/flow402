/**
 * Uniswap Trade API — Server-side Swap Executor
 *
 * Executes token swaps on behalf of the orchestrator wallet using the
 * Uniswap Trade API (trade-api.gateway.uniswap.org). The orchestrator's
 * server-side private key (ZG_PRIVATE_KEY) is used to sign and broadcast.
 *
 * Flow:
 *   1. Parse swap intent from user prompt   (parseSwapIntent)
 *   2. Fetch quote from Uniswap API         (POST /v1/quote)
 *   3. Build unsigned tx / UniswapX order   (POST /v1/swap | /v1/order)
 *   4. Sign permit2 if required             (wallet.signTypedData)
 *   5. Broadcast signed tx via ETH RPC      (wallet.sendTransaction)
 *
 * Env vars:
 *   UNISWAP_API_KEY  — Key from developers.uniswap.org
 *   SWAP_ENABLED     — "true" to activate (default off)
 *   SWAP_CHAIN_ID    — target chain (default: 1 = Ethereum mainnet)
 *   ETH_RPC_URL      — Ethereum RPC e.g. https://eth.llamarpc.com or Alchemy
 *
 * The same ZG_PRIVATE_KEY wallet is used — it operates on both 0G and
 * Ethereum (or any EVM chain) using the same private key.
 */

import { ethers } from 'ethers'

const UNISWAP_BASE    = 'https://trade-api.gateway.uniswap.org/v1'
const UNISWAP_API_KEY = process.env.UNISWAP_API_KEY || ''
const SWAP_CHAIN_ID   = parseInt(process.env.SWAP_CHAIN_ID || '11155111', 10)
// Reliable public Sepolia RPC — override with ETH_RPC_URL env for Alchemy/Infura
const ETH_RPC_URL     = process.env.ETH_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

/** Native ETH address in Uniswap notation */
const NATIVE_ETH = '0x0000000000000000000000000000000000000000'

/** Well-known token addresses by chainId → symbol */
const TOKENS: Record<string, Record<string, string>> = {
  '11155111': { // Ethereum Sepolia testnet
    ETH:  NATIVE_ETH,
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    DAI:  '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
    UNI:  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  },
  '1': {  // Ethereum mainnet (kept for completeness but not default)
    ETH:  NATIVE_ETH,
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    UNI:  '0x1f9840a85d5aF5bf1D1762F925BDAaDdC4201F984',
  },
  '8453': { // Base
    ETH:  NATIVE_ETH,
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    DAI:  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  },
  '42161': { // Arbitrum
    ETH:  NATIVE_ETH,
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface SwapIntent {
  /** Token to spend — symbol ('ETH', 'USDC') or checksummed address */
  tokenIn:  string
  /** Token to receive — symbol or checksummed address */
  tokenOut: string
  /** Human-readable amount of tokenIn to spend (e.g. '0.0001') */
  amountIn: string
  chainId?: number
  /** Slippage tolerance in percent (default 0.5) */
  slippage?: number
  /** Optional reason from agent analysis, emitted in the event */
  reason?: string
}

export interface SwapResult {
  success:    boolean
  txHash?:    string   // tx hash for AMM swaps; orderId for UniswapX
  amountIn:   string
  amountOut:  string
  tokenIn:    string
  tokenOut:   string
  chainId:    number
  routing?:   string   // CLASSIC | DUTCH_V2 | DUTCH_V3 | PRIORITY
  explorerUrl?: string
  error?:     string
}

// ── Prompt parser ─────────────────────────────────────────────────────────────

/**
 * Extract swap intent from natural language prompt.
 *
 * Recognised patterns:
 *   "buy 0.0001 ETH worth of USDC"
 *   "swap 0.0001 ETH for USDC"
 *   "buy 0.0001 ETH of USDC"
 *   "trade 0.0001 ETH for DAI"
 */
export function parseSwapIntent(prompt: string): SwapIntent | null {
  // Pattern: buy/swap/trade [X] TOKEN [worth of / for / of / to] TOKEN2
  const match = prompt.match(
    /\b(?:buy|purchase|swap|trade|sell)\s+([\d.]+)?\s*(ETH|WETH|USDC|USDT|WBTC|DAI|UNI|LINK|AAVE|ARB)\s+(?:worth\s+of|of|for|to)\s+(ETH|WETH|USDC|USDT|WBTC|DAI|UNI|LINK|AAVE|ARB)\b/i
  )
  if (match) {
    const amount = match[1] || (['ETH', 'WETH'].includes(match[2].toUpperCase()) ? '0.0001' : '1')
    return {
      tokenIn:  match[2].toUpperCase(),
      tokenOut: match[3].toUpperCase(),
      amountIn: amount,
      chainId:  SWAP_CHAIN_ID,
    }
  }

  // Pattern: "buy [X] ETH [worth of] USDC" (tokenOut implied as ETH spend)
  const shortMatch = prompt.match(
    /\b(?:buy|purchase|swap)\s+([\d.]+)?\s*(ETH)\s+(?:worth\s+of\s+)(ETH|WETH|USDC|USDT|WBTC|DAI|UNI|LINK|AAVE|ARB)\b/i
  )
  if (shortMatch) {
    const amount = shortMatch[1] || '0.0001'
    return {
      tokenIn:  'ETH',
      tokenOut: shortMatch[3].toUpperCase(),
      amountIn: amount,
      chainId:  SWAP_CHAIN_ID,
    }
  }

  // Catch-all: "buy 0.0001 ETH", "swap USDC"
  const veryShortMatch = prompt.match(/\b(?:buy|swap|trade|purchase)\s+([\d.]+)?\s*(ETH|WETH|USDC|DAI|UNI)\b/i)
  if (veryShortMatch) {
    const targetToken = veryShortMatch[2].toUpperCase()
    // If they ask to buy/swap ETH, assume they want to spend USDC to get ETH.
    // Otherwise, assume they want to spend ETH to get the token.
    const tokenIn = ['ETH', 'WETH'].includes(targetToken) ? 'USDC' : 'ETH'
    const tokenOut = targetToken
    const amountIn = veryShortMatch[1] || (tokenIn === 'ETH' ? '0.0001' : '1')
    return {
      tokenIn,
      tokenOut,
      amountIn,
      chainId: SWAP_CHAIN_ID,
    }
  }

  return null
}

// ── Token address resolution ──────────────────────────────────────────────────

function resolveToken(symbolOrAddress: string, chainId: number): string {
  if (symbolOrAddress.startsWith('0x') && symbolOrAddress.length === 42) {
    return symbolOrAddress // Already an address
  }
  const chainTokens = TOKENS[String(chainId)] ?? TOKENS['1']
  return chainTokens[symbolOrAddress.toUpperCase()] ?? symbolOrAddress
}

function explorerForChain(chainId: number, txHash: string): string {
  switch (chainId) {
    case 11155111: return `https://sepolia.etherscan.io/tx/${txHash}`
    case 1:        return `https://etherscan.io/tx/${txHash}`
    case 8453:     return `https://basescan.org/tx/${txHash}`
    case 42161:    return `https://arbiscan.io/tx/${txHash}`
    default:       return `https://sepolia.etherscan.io/tx/${txHash}`
  }
}

// ── Core swap executor ────────────────────────────────────────────────────────

/**
 * Execute a swap using the Uniswap Trade API.
 *
 * Handles both CLASSIC (AMM) and UniswapX (DUTCH_V2/V3/PRIORITY) routing.
 * For ETH input, no Permit2 approval is needed.
 */
export async function executeSwap(intent: SwapIntent): Promise<SwapResult> {
  if (!UNISWAP_API_KEY) {
    return { success: false, amountIn: intent.amountIn, amountOut: '0', tokenIn: intent.tokenIn, tokenOut: intent.tokenOut, chainId: intent.chainId ?? SWAP_CHAIN_ID, error: 'UNISWAP_API_KEY not set' }
  }

  const chainId  = intent.chainId ?? SWAP_CHAIN_ID
  const tokenIn  = resolveToken(intent.tokenIn,  chainId)
  const tokenOut = resolveToken(intent.tokenOut, chainId)

  if (tokenIn === intent.tokenIn.toUpperCase() && !tokenIn.startsWith('0x')) {
    return { success: false, amountIn: intent.amountIn, amountOut: '0', tokenIn: intent.tokenIn, tokenOut: intent.tokenOut, chainId, error: `Unknown token symbol: ${intent.tokenIn}` }
  }

  // Amount in wei (ETH has 18 decimals; USDC/USDT have 6 — handle below)
  const isNativeIn = tokenIn === NATIVE_ETH || intent.tokenIn.toUpperCase() === 'ETH'
  const decimalsIn = isNativeIn ? 18 : guessDecimals(intent.tokenIn)
  const amountWei  = ethers.parseUnits(intent.amountIn, decimalsIn)

  // Signer-only wallet — no RPC connection, used for address + Permit2 signing.
  // Provider is only connected at broadcast time to avoid early RPC failure.
  const signer  = new ethers.Wallet(process.env.ZG_PRIVATE_KEY!)
  const swapper = signer.address

  console.log(`[swap] Quote: ${intent.amountIn} ${intent.tokenIn} → ${intent.tokenOut} (chain ${chainId}), swapper=${swapper}`)

  // ── 1. Get quote ────────────────────────────────────────────────────────────
  const quoteResp = await fetch(`${UNISWAP_BASE}/quote`, {
    method: 'POST',
    headers: {
      'x-api-key':    UNISWAP_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify({
      tokenIn,
      tokenOut,
      tokenInChainId:  chainId,
      tokenOutChainId: chainId,
      type:            'EXACT_INPUT',
      amount:          amountWei.toString(),
      swapper,
      slippageTolerance: intent.slippage ?? 0.5,
    }),
  })

  if (!quoteResp.ok) {
    const err = await quoteResp.text()
    return { success: false, amountIn: intent.amountIn, amountOut: '0', tokenIn: intent.tokenIn, tokenOut: intent.tokenOut, chainId, error: `Quote failed (${quoteResp.status}): ${err.slice(0, 200)}` }
  }

  interface QuoteData { quote: Record<string, unknown>; permitData: Record<string, unknown> | null; routing: string }
  const { quote, permitData, routing } = await quoteResp.json() as QuoteData

  // Output amount — Uniswap CLASSIC quote nests it in quote.output.amount
  // Shape: { output: { token: {...}, amount: "123456", minimumAmount: "..." } }
  const outputField = quote.output as { amount?: string } | string | null | undefined
  const rawOut =
    (typeof outputField === 'object' && outputField !== null && outputField.amount)
      ? outputField.amount
      : String(quote.outputAmount ?? outputField ?? '0')
  const decimalsOut = guessDecimals(intent.tokenOut)
  const amountOut   = safeFormat(rawOut, decimalsOut)

  console.log(`[swap] Routing=${routing}, output≈${amountOut} ${intent.tokenOut}`)

  let txHash: string

  // ── 2a. UniswapX order flow ─────────────────────────────────────────────────
  if (['DUTCH_V2', 'DUTCH_V3', 'PRIORITY'].includes(routing)) {
    let signature: string | undefined
    if (permitData) {
      // Uniswap returns { domain, types, values } — NOT an array
      const { domain, types, values, value } = permitData as {
        domain: Parameters<typeof signer.signTypedData>[0]
        types:  Parameters<typeof signer.signTypedData>[1]
        values?: Parameters<typeof signer.signTypedData>[2]
        value?:  Parameters<typeof signer.signTypedData>[2]
      }
      signature = await signer.signTypedData(domain, types, values ?? value ?? {})
    }

    const orderResp = await fetch(`${UNISWAP_BASE}/order`, {
      method: 'POST',
      headers: { 'x-api-key': UNISWAP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote, ...(permitData && signature ? { signature, permitData } : {}) }),
    })
    if (!orderResp.ok) {
      const err = await orderResp.text()
      return { success: false, amountIn: intent.amountIn, amountOut, tokenIn: intent.tokenIn, tokenOut: intent.tokenOut, chainId, routing, error: `Order failed (${orderResp.status}): ${err.slice(0, 200)}` }
    }
    const orderData = await orderResp.json() as { orderId?: string; hash?: string }
    txHash = orderData.orderId ?? orderData.hash ?? 'pending'

  // ── 2b. Classic AMM flow ────────────────────────────────────────────────────
  } else {
    let signature: string | undefined
    if (permitData) {
      // Uniswap returns { domain, types, values } — NOT an array
      const { domain, types, values, value } = permitData as {
        domain: Parameters<typeof signer.signTypedData>[0]
        types:  Parameters<typeof signer.signTypedData>[1]
        values?: Parameters<typeof signer.signTypedData>[2]
        value?:  Parameters<typeof signer.signTypedData>[2]
      }
      console.log('[swap] Signing Permit2:', JSON.stringify({ domain, typeKeys: Object.keys(types ?? {}), value: values ?? value }))
      signature = await signer.signTypedData(domain, types, values ?? value ?? {})
    }

    const swapResp = await fetch(`${UNISWAP_BASE}/swap`, {
      method: 'POST',
      headers: { 'x-api-key': UNISWAP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote, ...(permitData && signature ? { signature, permitData } : {}) }),
    })
    if (!swapResp.ok) {
      const err = await swapResp.text()
      return { success: false, amountIn: intent.amountIn, amountOut, tokenIn: intent.tokenIn, tokenOut: intent.tokenOut, chainId, routing, error: `Swap build failed (${swapResp.status}): ${err.slice(0, 200)}` }
    }

    interface TxReq { to: string; from: string; data: string; value: string; chainId?: number; gasLimit?: string }
    const { swap } = await swapResp.json() as { swap: TxReq }

    // Validate tx before broadcast
    if (!swap.data || swap.data === '' || swap.data === '0x') {
      return { success: false, amountIn: intent.amountIn, amountOut, tokenIn: intent.tokenIn, tokenOut: intent.tokenOut, chainId, routing, error: 'Swap tx has empty data — refusing to broadcast' }
    }

    // Create provider + connect signer only now (just before broadcast)
    const provider = new ethers.JsonRpcProvider(ETH_RPC_URL)
    const wallet   = signer.connect(provider)

    // ── Permit2 ERC-20 allowance guard ─────────────────────────────────────────
    // For ERC-20 inputs (not native ETH), Permit2 needs a standard on-chain
    // approve() before the off-chain PermitSingle signature is accepted.
    // The Universal Router will revert with no reason if this is missing.
    if (!isNativeIn) {
      const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
      const erc20   = new ethers.Contract(tokenIn, [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
      ], wallet)

      const currentAllowance: bigint = await erc20.allowance(wallet.address, PERMIT2)
      console.log(`[swap] Permit2 allowance for ${intent.tokenIn}: ${currentAllowance} (need ${amountWei})`)

      if (currentAllowance < amountWei) {
        console.log(`[swap] Approving Permit2 to spend ${intent.tokenIn} (MaxUint256)…`)
        const approveTx = await erc20.approve(PERMIT2, ethers.MaxUint256)
        const approveReceipt = await approveTx.wait()
        console.log(`[swap] Permit2 approved ✓ tx=${approveReceipt?.hash ?? approveTx.hash}`)
      } else {
        console.log(`[swap] Permit2 allowance sufficient ✓`)
      }
    }

    // Broadcast signed swap transaction
    const tx = await wallet.sendTransaction({
      to:       swap.to,
      data:     swap.data,
      value:    BigInt(swap.value || '0'),
      gasLimit: swap.gasLimit ? BigInt(swap.gasLimit) : undefined,
    })
    const receipt = await tx.wait()
    txHash = receipt?.hash ?? tx.hash
  }

  console.log(`[swap] ✓ txHash=${txHash}`)

  return {
    success:     true,
    txHash,
    amountIn:    intent.amountIn,
    amountOut,
    tokenIn:     intent.tokenIn,
    tokenOut:    intent.tokenOut,
    chainId,
    routing,
    explorerUrl: explorerForChain(chainId, txHash),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Best-guess decimals for common tokens */
function guessDecimals(symbol: string): number {
  const s = symbol.toUpperCase()
  if (['USDC', 'USDT'].includes(s)) return 6
  if (['WBTC'].includes(s))         return 8
  return 18  // ETH, WETH, DAI, UNI, LINK, AAVE, ARB, …
}

/** Format raw bigint string to human-readable, capped at 8 decimal places */
function safeFormat(raw: string, decimals: number): string {
  try {
    return parseFloat(ethers.formatUnits(BigInt(raw), decimals)).toFixed(6)
  } catch {
    return raw
  }
}
