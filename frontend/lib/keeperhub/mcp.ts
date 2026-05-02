/**
 * KeeperHub — on-chain commitment via REST API
 *
 * KeeperHub is a decentralised keeper / workflow automation network.
 * We use it for guaranteed on-chain settlement of Orcha-net run commitments.
 *
 * Authentication: Bearer token (API key from app.keeperhub.com).
 * The execution triggers a pre-configured workflow that calls
 * AgentRegistry.commitRun() on 0G Chain.
 *
 * REST API base: https://app.keeperhub.com/api
 * Auth header:   Authorization: Bearer <KEEPERHUB_API_KEY>
 *
 * Docs: https://docs.keeperhub.com/api/executions
 *       https://docs.keeperhub.com/api/direct-execution
 */

const KH_API_BASE = 'https://app.keeperhub.com/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KeeperRunParams {
  runId: string
  rootHash: string
  agentTypes: string[]
  contractAddress?: string
}

export interface KeeperExecutionResult {
  executionId: string
  status: 'pending' | 'running' | 'success' | 'failed'
  txHash: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAuth(): { apiKey: string; workflowId: string } {
  const apiKey     = process.env.KEEPERHUB_API_KEY     || ''
  const workflowId = process.env.KEEPERHUB_WORKFLOW_ID || ''
  if (!apiKey || !workflowId) {
    throw new Error(
      'KEEPERHUB_API_KEY and KEEPERHUB_WORKFLOW_ID must be set. ' +
      'Get your API key at app.keeperhub.com → Settings → API Keys.'
    )
  }
  return { apiKey, workflowId }
}

async function khFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey } = getAuth()
  const res = await fetch(`${KH_API_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`KeeperHub API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Trigger workflow execution ────────────────────────────────────────────────

/**
 * Trigger a KeeperHub workflow that commits a run to AgentRegistry on-chain.
 *
 * The workflow must be pre-configured in KeeperHub to:
 *  1. Call AgentRegistry.commitRun(runId, bytes32(rootHash), agentTypes[])
 *  2. On 0G Galileo Testnet (chainId 16602)
 *  3. Using the keeper wallet funded with A0GI (testnet gas token)
 *
 * Returns executionId + txHash (once settled).
 */
export async function triggerRunCommitment(
  params: KeeperRunParams
): Promise<KeeperExecutionResult> {
  const { workflowId } = getAuth()

  // KeeperHub workflow execution endpoint
  // See: https://docs.keeperhub.com/api/executions
  const result = await khFetch<{
    id: string
    status: string
    result?: { txHash?: string; transactionHash?: string }
  }>('/executions', {
    method: 'POST',
    body: JSON.stringify({
      workflowId,
      input: {
        runId:       params.runId,
        rootHash:    params.rootHash,
        agentTypes:  params.agentTypes,
        contract:    params.contractAddress ?? process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ?? '',
        chainId:     16602, // 0G Galileo Testnet (updated from 16601)
      },
    }),
  })

  const txHash =
    result.result?.txHash ??
    result.result?.transactionHash ??
    ''

  return {
    executionId: result.id,
    status: (result.status as KeeperExecutionResult['status']) ?? 'pending',
    txHash,
  }
}

// ── Poll execution status ─────────────────────────────────────────────────────

/**
 * Poll a KeeperHub execution until it completes or times out.
 */
export async function pollExecution(
  executionId: string,
  timeoutMs = 60_000,
  intervalMs = 3_000
): Promise<KeeperExecutionResult> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const result = await khFetch<{
      id: string
      status: string
      result?: { txHash?: string; transactionHash?: string }
    }>(`/executions/${executionId}`)

    const status = result.status as KeeperExecutionResult['status']
    if (status === 'success' || status === 'failed') {
      return {
        executionId: result.id,
        status,
        txHash:
          result.result?.txHash ??
          result.result?.transactionHash ??
          '',
      }
    }

    await new Promise<void>((r) => setTimeout(r, intervalMs))
  }

  throw new Error(`KeeperHub execution ${executionId} timed out after ${timeoutMs}ms`)
}

// ── Get workflow list (utility) ───────────────────────────────────────────────

export async function listWorkflows(): Promise<{ id: string; name: string; status: string }[]> {
  try {
    const data = await khFetch<{ items?: { id: string; name: string; status: string }[] }>('/workflows')
    return data.items ?? []
  } catch {
    return []
  }
}
