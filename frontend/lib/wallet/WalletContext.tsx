'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ethers } from 'ethers'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WalletContextValue {
  address: string | null
  chainId: number | null
  connecting: boolean
  connected: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue>({
  address: null,
  chainId: null,
  connecting: false,
  connected: false,
  connect: async () => {},
  disconnect: () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Typed wrappers so we don't scatter `as unknown as X` everywhere
function eth() {
  return typeof window !== 'undefined' ? window.ethereum : undefined
}

async function ethRequest<T>(method: string, params: unknown[] = []): Promise<T> {
  const e = eth()
  if (!e) throw new Error('No wallet detected')
  return e.request({ method, params }) as Promise<T>
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Re-connect silently if already authorised (page refresh)
  useEffect(() => {
    if (typeof window === 'undefined' || !eth()) return

    const saved = localStorage.getItem('wallet_address')
    if (saved) {
      ethRequest<string[]>('eth_accounts').then((accs) => {
        if (accs[0]?.toLowerCase() === saved.toLowerCase()) {
          setAddress(accs[0])
          ethRequest<string>('eth_chainId').then((cid) => setChainId(parseInt(cid, 16))).catch(() => {})
        } else {
          localStorage.removeItem('wallet_address')
        }
      }).catch(() => {})
    }

    // EIP-1193 events
    const onAccounts = (accs: unknown) => {
      const list = accs as string[]
      if (list.length === 0) {
        setAddress(null)
        localStorage.removeItem('wallet_address')
      } else {
        setAddress(list[0])
        localStorage.setItem('wallet_address', list[0])
      }
    }
    const onChain = (cid: unknown) => setChainId(parseInt(cid as string, 16))

    eth()!.on('accountsChanged', onAccounts)
    eth()!.on('chainChanged', onChain)
    return () => {
      eth()?.removeListener('accountsChanged', onAccounts)
      eth()?.removeListener('chainChanged', onChain)
    }
  }, [])

  async function connect() {
    if (!eth()) {
      alert('No wallet detected. Install MetaMask or another EVM wallet.')
      return
    }
    setConnecting(true)
    try {
      const provider = new ethers.BrowserProvider(eth()!)
      const accs = await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()
      setAddress(accs[0])
      setChainId(Number(network.chainId))
      localStorage.setItem('wallet_address', accs[0])
    } catch (err) {
      console.error('Wallet connect failed:', err)
    } finally {
      setConnecting(false)
    }
  }

  function disconnect() {
    setAddress(null)
    setChainId(null)
    localStorage.removeItem('wallet_address')
  }

  return (
    <WalletContext.Provider value={{ address, chainId, connecting, connected: !!address, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}
