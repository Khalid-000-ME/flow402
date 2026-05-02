/**
 * 0G Compute Network — inference wrapper
 *
 * Uses @0gfoundation/0g-compute-ts-sdk (broker SDK) which provides:
 *   - createZGComputeNetworkBroker(wallet) — on-chain account management
 *   - broker.inference.getServiceMetadata(providerAddr) — endpoint + model
 *   - broker.inference.getRequestHeaders(providerAddr) — signed auth header
 *   - broker.inference.processResponse(...) — on-chain settlement, returns txHash
 *
 * Alternatively (and preferably in CI/preview), use the simple OpenAI SDK path
 * with ZG_SERVICE_URL + ZG_API_SECRET (generated via 0g-compute-cli).
 *
 * Docs: https://build.0g.ai/compute/
 */

import { ethers } from 'ethers'
import OpenAI from 'openai'

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL    = process.env.ZG_RPC_URL    || 'https://evmrpc-testnet.0g.ai'
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY || ''
// Preferred: simple API key path (generated via 0g-compute-cli get-secret)
const ZG_SERVICE_URL = process.env.ZG_SERVICE_URL || ''
const ZG_API_SECRET  = process.env.ZG_API_SECRET  || ''

// Testnet default provider (Qwen 2.5 7B) — override per-agent via env
export const DEFAULT_PROVIDER_ADDR =
  process.env.ZG_PROVIDER_DEFAULT || '0xa48f01287233509FD694a22Bf840225062E67836'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InferenceResult {
  content: string
  /** True if the provider's TEE signature was verified by processResponse() */
  verified: boolean
  model: string
  provider: string
  promptTokens: number
  completionTokens: number
}

// ── Broker singleton (lazy) ───────────────────────────────────────────────────

let _broker: Awaited<ReturnType<typeof createBroker>> | null = null

async function createBroker() {
  const { createZGComputeNetworkBroker } = await import('@0gfoundation/0g-compute-ts-sdk')
  const zgProvider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, zgProvider)
  return createZGComputeNetworkBroker(wallet)
}

async function getBroker() {
  if (!_broker) _broker = await createBroker()
  return _broker
}

// ── Retry helper ──────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) await sleep(delayMs * (i + 1))
    }
  }
  throw lastError
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ── Main inference function ───────────────────────────────────────────────────

/**
 * Run inference via 0G Compute Network.
 *
 * Strategy:
 *  1. If ZG_SERVICE_URL + ZG_API_SECRET are set, use OpenAI SDK (simple key auth).
 *     This is the path produced by `0g-compute-cli inference get-secret`.
 *  2. Otherwise, fall back to broker SDK (on-chain signed headers + settlement).
 *
 * Both paths call processResponse() to settle on-chain and return the txHash.
 */
export async function runInference(
  providerAddress: string,
  messages: { role: string; content: string }[],
  systemPrompt: string,
  opts: { maxTokens?: number } = {}
): Promise<InferenceResult> {
  // Validate
  if (!PRIVATE_KEY) {
    throw new Error('ZG_PRIVATE_KEY is required for 0G Compute inference')
  }

  // Path A: Simple OpenAI-compatible key (preferred)
  if (ZG_SERVICE_URL && ZG_API_SECRET) {
    return withRetry(() =>
      runWithOpenAIKey(providerAddress, messages, systemPrompt, opts)
    )
  }

  // Path B: Broker SDK (wallet-based auth + on-chain settlement)
  return withRetry(() =>
    runWithBroker(providerAddress, messages, systemPrompt, opts)
  )
}

async function runWithOpenAIKey(
  providerAddress: string,
  messages: { role: string; content: string }[],
  systemPrompt: string,
  opts: { maxTokens?: number }
): Promise<InferenceResult> {
  const client = new OpenAI({
    baseURL: `${ZG_SERVICE_URL}/v1/proxy`,
    apiKey: ZG_API_SECRET,
  })

  const response = await client.chat.completions.create({
    model: process.env.ZG_MODEL || 'qwen/qwen-2.5-7b-instruct',
    max_tokens: opts.maxTokens ?? 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(messages as OpenAI.Chat.ChatCompletionMessageParam[]),
    ],
  })

  const content = response.choices[0].message.content ?? ''
  const usage   = response.usage ?? { prompt_tokens: 0, completion_tokens: 0 }

  // processResponse verifies the TEE signature on the response.
  // It returns: true = verified, false = unverifiable service, null = no chatID.
  // The actual settlement txHash comes from the SDK's auto-funding mechanism
  // (transferFund transactions) which are handled internally by getRequestHeaders.
  const broker = await getBroker()
  let verified = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyResult: any = await broker.inference.processResponse(
      providerAddress,
      response.id,
      JSON.stringify({ input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens })
    )
    verified = verifyResult === true
  } catch (settleErr) {
    console.warn('[0G Compute] processResponse failed:', settleErr instanceof Error ? settleErr.message : settleErr)
  }

  return {
    content,
    verified,
    model: response.model,
    provider: providerAddress,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  }
}

async function runWithBroker(
  providerAddress: string,
  messages: { role: string; content: string }[],
  systemPrompt: string,
  opts: { maxTokens?: number }
): Promise<InferenceResult> {
  const broker = await getBroker()

  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
  const headers = await broker.inference.getRequestHeaders(providerAddress)

  const body = JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`0G Compute (broker) error ${res.status}: ${text}`)
  }

  // Read raw body ONCE as text
  const rawBody = await res.text()
  const data    = JSON.parse(rawBody)
  const content = data.choices?.[0]?.message?.content ?? ''
  const usage   = data.usage ?? { prompt_tokens: 0, completion_tokens: 0 }

  // processResponse verifies the TEE signature. Returns true/false/null — NOT a txHash.
  // The settlement (fund lock) txHash is emitted internally by the SDK's auto-funder
  // and printed as 'tx hash: 0x...' in the server logs.
  let verified = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyResult: any = await broker.inference.processResponse(
      providerAddress,
      data.id,
      JSON.stringify({ input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens })
    )
    verified = verifyResult === true
  } catch (settleErr) {
    console.warn('[0G Compute] processResponse failed:', settleErr instanceof Error ? settleErr.message : settleErr)
  }

  return {
    content,
    verified,
    model,
    provider: providerAddress,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  }
}

// ── Provider utilities ────────────────────────────────────────────────────────

/** List available providers from compute marketplace */
export async function listProviders(): Promise<{ address: string; model: string; price: string }[]> {
  try {
    const broker = await getBroker()
    const services = await broker.inference.listService()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return services.map((s: any) => ({
      address: s.providerAddress ?? s.provider ?? '',
      model: s.model ?? 'unknown',
      price: s.pricePerToken ?? '0',
    }))
  } catch {
    return []
  }
}

/** Get balance of the compute account */
export async function getComputeBalance(): Promise<string> {
  try {
    if (!PRIVATE_KEY) return '0'
    const broker = await getBroker()
    const account = await broker.inference.getAccount(
      new ethers.Wallet(PRIVATE_KEY).address
    )
    return account?.balance?.toString() ?? '0'
  } catch {
    return '0'
  }
}
