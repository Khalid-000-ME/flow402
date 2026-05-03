/**
 * Orchestrator Wallet
 *
 * A server-side ethers.Wallet loaded from ZG_PRIVATE_KEY.
 * Gives the orchestrator the ability to:
 *   - Send native OG tokens (payments, fees)
 *   - Call any ERC-20 / DEX contract (trades, swaps)
 *
 * The wallet is the SAME key used for 0G Storage uploads, so no extra
 * env var is needed. It is created lazily and cached.
 */

import { ethers } from 'ethers'

const RPC_URL    = process.env.ZG_RPC_URL     || 'https://evmrpc-testnet.0g.ai'
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY || ''

// ── Singleton provider + wallet ──────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null
let _wallet:   ethers.Wallet | null = null

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL)
  return _provider
}

export function getOrchestratorWallet(): ethers.Wallet {
  if (!PRIVATE_KEY) throw new Error('ZG_PRIVATE_KEY is required for orchestrator wallet')
  if (!_wallet) _wallet = new ethers.Wallet(PRIVATE_KEY, getProvider())
  return _wallet
}

export async function getOrchestratorAddress(): Promise<string> {
  return getOrchestratorWallet().address
}

// ── Payment primitives ────────────────────────────────────────────────────────

export interface PaymentResult {
  txHash: string
  from: string
  to: string
  amount: string      // human-readable OG amount
  explorerUrl: string
  blockNumber?: number
}

/**
 * Send native OG tokens from the orchestrator wallet to a recipient.
 * @param to      Recipient address
 * @param amountOG  Amount in OG (e.g. "0.01")
 */
export async function sendPayment(to: string, amountOG: string): Promise<PaymentResult> {
  const wallet = getOrchestratorWallet()
  const value  = ethers.parseEther(amountOG)

  const tx = await wallet.sendTransaction({ to, value })
  const receipt = await tx.wait()

  return {
    txHash: tx.hash,
    from: wallet.address,
    to,
    amount: amountOG,
    explorerUrl: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
    blockNumber: receipt?.blockNumber,
  }
}

// ── ERC-20 transfer ───────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
]

export interface TokenTransferResult {
  txHash: string
  token: string
  symbol: string
  to: string
  amount: string
  explorerUrl: string
}

/**
 * Transfer ERC-20 tokens from the orchestrator wallet.
 * @param tokenAddress  Contract address of the ERC-20 token
 * @param to            Recipient address
 * @param amount        Human-readable amount (e.g. "100")
 */
export async function transferToken(
  tokenAddress: string,
  to: string,
  amount: string
): Promise<TokenTransferResult> {
  const wallet   = getOrchestratorWallet()
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet)
  const decimals = await contract.decimals() as bigint
  const symbol   = await contract.symbol() as string
  const raw      = ethers.parseUnits(amount, decimals)

  const tx = await contract.transfer(to, raw)
  await tx.wait()

  return {
    txHash: tx.hash,
    token: tokenAddress,
    symbol,
    to,
    amount,
    explorerUrl: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
  }
}

// ── Balance helpers ───────────────────────────────────────────────────────────

export async function getOrchestratorBalance(): Promise<{ og: string; address: string }> {
  const wallet  = getOrchestratorWallet()
  const balance = await getProvider().getBalance(wallet.address)
  return {
    og: ethers.formatEther(balance),
    address: wallet.address,
  }
}
