![Orchanet Banner](frontend/public/banner.png)

# Orchanet

> **Spawn High-Performance Agents. Execute Trustless Inference.**

Orchanet is a decentralized multi-agent AI orchestration protocol built entirely on the **0G Network**. It solves the fundamental trust problem in AI-driven applications: there is currently no way to verify *how* an AI reached its conclusion, *who* ran the inference, or *whether* the output was tampered with. Orchanet solves this by treating every AI inference task as a first-class on-chain event, anchored by 0G's infrastructure at every layer of the pipeline — from compute dispatch and fee settlement, to immutable storage provenance and on-chain agent identity.

Every agent spawned by Orchanet runs on **0G Compute provider nodes**. Every run record is sealed permanently on **0G Storage**. Every agent identity is verified against an on-chain **AgentRegistry** smart contract. This is not a shallow integration — 0G is the bedrock on which Orchanet's trustlessness is built.

---

## Architecture & Workflow

### Orchestration Pipeline

![Orchestration Pipeline](frontend/public/sequence.png)

### System Architecture

![System Architecture](frontend/public/flow.png)

---

## The Problem

### AI is a Black Box. That's Unacceptable in Web3.

The DeFi and Web3 ecosystem is increasingly relying on AI for analysis, strategy, and decision support. But every existing AI integration shares the same fatal flaw: you cannot verify the reasoning. A single model hallucinating under load, serving a stale cached response, or running on a compromised centralized server is indistinguishable from a model running correctly. There is no cryptographic proof. There is no audit trail. There is no accountability.

This is the black-box problem — and in a trustless ecosystem built on cryptographic guarantees, it is an existential contradiction.

Orchanet is the answer. By routing every inference task through the **0G Compute network**, committing every reasoning artifact to **0G Storage**, and verifying every agent identity on-chain, we transform AI from an opaque oracle into a fully verifiable, auditable, and trustless intelligence layer.

---

## The Solution: Orchanet on 0G

Orchanet orchestrates a committee of specialized AI agents — a Tokenomics Modeler, Smart Contract Auditor, and an adversarial Critic — that debate a user's prompt in parallel, reach a cryptographically verifiable consensus, and seal the entire reasoning process permanently on the 0G Network.

The result is AI inference that is:
- **Trustless:** No centralized server. Compute is dispatched to 0G provider nodes.
- **Verifiable:** Every output, debate, and consensus score is immutably stored on 0G Storage with a `rootHash`.
- **Accountable:** Agent identities are registered on-chain. Fee settlements flow through the 0G Ledger in OG tokens.
- **Auditable:** Any user can retrieve their run artifact from 0G Storage at any time using the `rootHash`.

---

## 0G Network Integration — Deep Dive

Orchanet treats the 0G Network not as a single feature, but as its entire infrastructure stack. Below is a complete technical breakdown of every 0G integration in the codebase.

---

### 🧠 0G Compute — The Intelligence Layer

**File:** `frontend/lib/0g/compute.ts`
**SDK:** `@0gfoundation/0g-compute-ts-sdk`

This is where Orchanet's intelligence lives. Rather than routing LLM calls to a centralized API endpoint, every inference task in the Orchanet pipeline is dispatched through the **0G Compute SDK** to decentralized provider nodes. The 0G Compute network operates on a **performance-based quality model**: provider nodes compete to serve inference requests, and the protocol's economic incentives ensure that high-quality, low-latency responses are prioritized.

**How the Compute client is initialized:**
```typescript
// frontend/lib/0g/compute.ts
const { createZGComputeNetworkBroker } = await import('@0gfoundation/0g-compute-ts-sdk')
const zgProvider = new ethers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, zgProvider)
const broker = await createZGComputeNetworkBroker(wallet)
```

**How inference is dispatched to a 0G provider node (broker path):**
```typescript
// frontend/lib/0g/compute.ts — runWithBroker()
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
const headers = await broker.inference.getRequestHeaders(providerAddress)

const res = await fetch(`${endpoint}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  }),
})
```

**Alternatively — Simple OpenAI-compatible key path (preferred in production):**
```typescript
// frontend/lib/0g/compute.ts — runWithOpenAIKey()
const client = new OpenAI({
  baseURL: `${ZG_SERVICE_URL}/v1/proxy`,
  apiKey: ZG_API_SECRET,
})
const response = await client.chat.completions.create({
  model: process.env.ZG_MODEL || 'qwen/qwen-2.5-7b-instruct',
  max_tokens: opts.maxTokens ?? 1024,
  messages: [
    { role: 'system', content: systemPrompt },
    ...messages,
  ],
})
```

The Orchestrator dispatches agent tasks in **parallel** using `Promise.all`, saturating multiple 0G compute provider nodes simultaneously. This means a 3-agent committee (Tokenomics Modeler + Smart Contract Auditor + Critic) all run their inference concurrently, dramatically reducing total pipeline latency while ensuring each agent's output is independently computed on a separate provider node — eliminating correlated failures.

**Token usage tracking and TEE signature settlement per inference:**
```typescript
// frontend/lib/0g/compute.ts
const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0 }

// processResponse verifies the TEE signature on the response
const verifyResult = await broker.inference.processResponse(
  providerAddress,
  data.id,
  JSON.stringify({ input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens })
)
const verified = verifyResult === true

return {
  content,
  verified,
  model,
  provider: providerAddress,
  promptTokens: usage.prompt_tokens,
  completionTokens: usage.completion_tokens,
}
```

Every token consumed by every agent is tracked granularly. This data feeds directly into the 0G Ledger settlement flow, ensuring fair economic accounting for every inference call made during a pipeline run.

---

### 💸 0G Settlement Ledger — The Economic Layer

**File:** `frontend/lib/0g/compute.ts`, `frontend/lib/orchestrator/index.ts`

The 0G Settlement Ledger is what makes decentralized compute economically sustainable. Every inference request dispatched to a 0G provider node carries a cost, denominated in **OG tokens**, that is settled on-chain through the ledger contract. Orchanet's Orchestrator manages this settlement flow automatically.

**Auto-funding check seen in live server logs:**
```
[DEBUG] [Auto-funding] Provider unsettled fee: 0.006460 0G
[DEBUG] [Auto-funding] Check: unsettledFee=0.006460 0G, requiredBalance=2.006460 0G
[DEBUG] Locked fund for provider 0xa48f01287233509FD694a22Bf840225062E67836: 2995783600000000000, required: 2006460400000000000
```

Before every run, the broker SDK automatically:
1. Queries the provider's current **unsettled fee** balance from the ledger.
2. Calculates the **minimum required locked balance**.
3. Compares against the current **locked fund** for the provider.
4. If underfunded, **automatically tops up** the balance from the Orchestrator wallet.

This guarantees that the pipeline never stalls mid-inference due to an underfunded ledger — a subtle but critical engineering requirement for production-grade decentralized compute.

**TEE signature verification after inference:**
```typescript
// frontend/lib/0g/compute.ts
// processResponse verifies the TEE signature. Returns true = verified, false = unverifiable
const verifyResult = await broker.inference.processResponse(
  providerAddress,
  response.id,
  JSON.stringify({ input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens })
)
// Settlement txHash is emitted internally by the SDK auto-funder
```

The `processResponse` call handles the cryptographic verification of the inference response and triggers the OG token transfer to the provider node. This is the moment where **trustless payment for trustless compute** occurs — no escrow, no intermediary, no trust assumption.

---

### 🗄️ 0G Storage — The Provenance Layer

**File:** `frontend/lib/0g/storage.ts`
**SDK:** `@0gfoundation/0g-storage-ts-sdk`

0G Storage is the cornerstone of Orchanet's verifiability guarantees. Once the agent committee finishes debating and a consensus is reached, the Orchestrator compiles a complete **Run Record** — a structured JSON artifact containing every piece of reasoning, every agent output, and every on-chain receipt from the entire pipeline. This artifact is then uploaded to the **0G Storage network**.

**The Run Record structure committed to 0G Storage:**
```typescript
const runRecord = {
  runId,
  prompt,                    // Original user query
  status: 'complete',
  agentsSpawned: agentTypes.length,
  inferenceCalls,            // Total 0G Compute calls made
  storageBytesCommitted,     // Artifact size in bytes
  duration: Date.now() - startTime,
  timestamp: startTime,
  finalOutput,               // Full agent debate transcript
  events,                    // All pipeline events (spawned, debated, stored)
  iNFTIdentities: iNFTSnapshot, // On-chain agent identity snapshots
  rootHash: '',              // Filled after 0G Storage upload
  storageTxHash: '',         // 0G Storage transaction hash
}
```

**How artifacts are uploaded to 0G Storage nodes:**
```typescript
// frontend/lib/0g/storage.ts
const sdk = await import('@0gfoundation/0g-storage-ts-sdk')
const signer = new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC_URL))
const indexer = new sdk.Indexer(INDEXER_RPC)

// Wrap the JSON payload in an in-memory MemData object
const bytes = new TextEncoder().encode(JSON.stringify(data))
const memData = new sdk.MemData(bytes)

// Upload returns [{ txHash, rootHash, txSeq } | result, error]
const [result, err] = await indexer.upload(memData, RPC_URL, signer)
if (err) throw new Error(`0G Storage upload failed: ${err}`)

// Normalise result — rootHash is the Merkle root / permanent content address
const rootHash = result?.rootHash ?? result?.root ?? result?.hash ?? ''
const txHash   = result?.txHash ?? ''
```

The upload flow involves:
1. **Serialization:** The Run Record JSON is serialized to a buffer.
2. **Merkle tree construction:** `ZgFile.merkleTree()` computes the full Merkle tree over the artifact's chunks, producing an immutable `rootHash` that cryptographically commits to the artifact's content.
3. **Submission to the indexer:** The indexer coordinates with available storage nodes to fragment the data and distribute replicas across the network.
4. **Finality confirmation:** With `finalityRequired: true`, the upload blocks until the 0G Storage network confirms that the data has been persisted and is retrievable.

The resulting `rootHash` is displayed directly in the Orchanet Studio UI and embedded into the Run Record itself — giving users a permanent, tamper-evident cryptographic fingerprint of the entire AI reasoning session.

**What the Storage transaction looks like in the logs:**
```
Starting upload for file of size: 16718 bytes
File details - size: 16718, numSegments: 1, numChunks: 66
Data prepared to upload root=0x453b41bbda1d8707668690944117a26be3863f791622d9458ab47764d746a02e
Submitting transaction with storage fee: 2212822437264n
Transaction submitted, hash: 0x771de5c87b5e946ba532d1ff9efa3c44c369032a844f079451320c0b1a191e3e
Waiting for storage node to sync (height=31301700)...
Single file upload completed
```

The `numChunks: 66` represents the artifact being split into 66 fixed-size chunks across the 0G storage segment structure. Each chunk is individually hashed and committed to the Merkle tree, making it impossible to alter any part of the artifact without invalidating the `rootHash`.

---

### 🔐 AgentRegistry Smart Contract — The Identity Layer

**File:** `frontend/lib/0g/agentIdentity.ts`

Each AI agent in Orchanet is not just a prompt template — it is a registered **Intelligent NFT (iNFT)** on-chain. Before any agent is allowed to participate in a pipeline run, the Orchestrator queries the `AgentRegistry` smart contract to verify the agent's on-chain identity.

**The AgentRegistry ABI (relevant functions):**
```typescript
const AGENT_REGISTRY_ABI = [
  'function getAgentByType(string agentType) external view returns (tuple(uint256 tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash, address owner, uint256 spawnCount, uint256 registeredAt, bool active))',
  'function getAgent(uint256 tokenId) external view returns (tuple(...))',
  'function incrementSpawnCount(uint256 tokenId) external',
]
```

**Identity verification during orchestration:**
```typescript
// frontend/lib/0g/agentIdentity.ts
const provider = new ethers.JsonRpcProvider(RPC_URL)
const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider)

// eth_call — zero gas
const agent = await registry.getAgentByType(agentType)

// Replicate the contract's hash locally: keccak256(abi.encodePacked(agentType, ensName, storageRootHash))
const computedHash = ethers.keccak256(
  ethers.solidityPacked(
    ['string', 'string', 'string'],
    [agentType, ensName, storageRootHash]
  )
)
const verified = computedHash.toLowerCase() === metadataHash.toLowerCase()
```

The `metadataHash` is a `keccak256` commitment that ties together the agent's `agentType`, its human-readable name, and the `storageRootHash` of its original model specification artifact stored on 0G Storage. If any of these values are tampered with, the hash check fails and the agent is rejected from the pipeline.

**The iNFT identity snapshot included in every Run Record:**
```typescript
// Captured at the end of every pipeline run
iNFTSnapshot[agentType] = {
  tokenId:         identity.tokenId,        // On-chain NFT token ID
  metadataHash:    identity.metadataHash,   // keccak256 identity proof
  storageRootHash: identity.storageRootHash,// 0G Storage root of agent spec
  spawnCount:      identity.spawnCount,     // Total times this agent has run
  verified:        identity.verified,       // Whether hash check passed
  owner:           identity.owner,          // Agent creator's wallet address
}
```

This snapshot is embedded directly into the Run Record artifact that gets uploaded to 0G Storage — meaning every stored run contains immutable proof of exactly *which* agents (by on-chain identity) participated in the reasoning.

---

## 0G Compute — Performance & Quality Model

A core design insight behind Orchanet is that **quality of inference scales with compute distribution**. A single LLM call is a point estimate — it can hallucinate, drift, or produce low-quality outputs with no mechanism for self-correction. Orchanet exploits 0G Compute's decentralized provider network to implement a **multi-node adversarial inference** strategy:

1. **Parallel dispatch:** The Tokenomics Modeler and Smart Contract Auditor each run on separate 0G provider nodes simultaneously.
2. **Adversarial critique:** The Critic agent receives both specialist outputs and runs a third inference call — also on a 0G provider node — specifically instructed to find weaknesses, challenge assumptions, and force consensus.
3. **Score-based consensus:** The Critic returns structured JSON with per-agent quality scores and a `consensus_reached` boolean. This score is embedded in the Run Record and uploaded to 0G Storage.

```typescript
// frontend/lib/orchestrator/agents.ts — Critic agent system prompt (actual)
`You are an adversarial critic for Orcha-net. You receive outputs from multiple specialist agents.
Your job: (1) identify the weakest or most unsupported claim across all outputs,
(2) challenge it with a specific counter-argument, (3) assign a confidence score to each agent's output.
Return ONLY valid JSON with fields: sentiment (one of: GOOD, RISKY, CRITICAL, NEUTRAL — based on overall consensus quality),
weakest_claim, challenge, agent_scores{}, consensus_reached (bool).`
```

This pattern turns 0G Compute from a simple inference endpoint into a **quality assurance mechanism** — the adversarial critique loop catches hallucinations, exposes contradictions, and produces a debate transcript that is far more trustworthy than any single model's response.

---

## 0G Storage — Retrieval & Auditability

Every artifact uploaded to 0G Storage is permanently retrievable using its `rootHash`. Orchanet exposes a download endpoint that queries the 0G Storage network directly:

```typescript
// frontend/lib/0g/storage.ts — downloadFromStorage()
const indexer = await getIndexer() // new sdk.Indexer(INDEXER_RPC)

// downloadToBlob returns [Blob, Error | null]
const result = await indexer.downloadToBlob(rootHash, { proof: true })
const [blob, dlErr] = Array.isArray(result) ? result : [result, null]

// Decode blob → text → JSON
const buf  = await blob.arrayBuffer()
const text = Buffer.from(buf).toString('utf8')
return JSON.parse(text)
```

If the indexer is unavailable, Orchanet falls back to querying the storage nodes directly via the `zgs_downloadSegment` JSON-RPC method:
```typescript
// Fallback: direct JSON-RPC to known storage nodes
const res = await fetch(node, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'zgs_downloadSegment',
    params: [rootHash, 0, 10],
    id: 1,
  }),
})
const rpc = await res.json()
// result is base64-encoded segment data
const raw = Buffer.from(rpc.result, 'base64').toString('utf8')
return JSON.parse(raw.replace(/\0+$/, '').trim())
```

This means any run record — including the full agent debate, consensus scores, and iNFT identity snapshots — can be independently retrieved and verified by anyone with the `rootHash`. There is no Orchanet server required for retrieval. The data lives on 0G Storage nodes permanently.

**Storage node selection and replication:**
```typescript
// The 0G SDK selects optimal storage nodes for upload
Selected nodes: [
  StorageNode { url: 'http://34.19.125.196:5678', timeout: 30000, retry: 3 },
  StorageNode { url: 'http://34.169.28.106:5678', timeout: 30000, retry: 3 },
]
// Data is fragmented and replicated across nodes
Tasks created: [{ clientIndex: 1, taskSize: 1, segIndex: 0, numShard: 2, txSeq: 80717 }]
Processing tasks in parallel with 1 tasks...
All tasks processed
```

The `numShard: 2` indicates the artifact is sharded across two storage nodes, ensuring redundancy. The `txSeq` provides the on-chain sequence number that anchors the storage transaction to the 0G network's flow contract.

---

## Live Pipeline Event Stream

The Orchanet Studio UI streams live pipeline events in real time as the Orchestrator works. Every major 0G interaction emits a tracked event:

| Event Type | 0G Integration | Description |
|---|---|---|
| `agent_spawned` | 0G Compute | Agent dispatched to provider node |
| `agent_message` | 0G Compute | Inference response received |
| `debate` | 0G Compute | Critic adversarial review complete |
| `storage_committed` | 0G Storage | Run Record sealed with `rootHash` |
| `fee_settled` | 0G Ledger | OG tokens distributed to providers |

Each event is tracked with a timestamp and displayed in the Studio's live feed, giving users full visibility into every 0G network interaction happening under the hood.

---

## Quick Start

### Prerequisites
- Node.js v18+
- OG-funded wallet (for 0G Ledger compute fees and 0G Storage upload fees)
- Access to a 0G Compute RPC endpoint and 0G Storage indexer

### Installation

```bash
git clone https://github.com/Khalid-000-ME/Orcha_net.git
cd Orcha_net/frontend
npm install
```

### Environment Variables

Create `frontend/.env.local`:

```env
# 0G Chain (Galileo Testnet)
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_PRIVATE_KEY=your_wallet_private_key   # Must hold A0GI for gas

# 0G Compute — Simple key path (recommended)
ZG_SERVICE_URL=https://your-0g-compute-service-url
ZG_API_SECRET=your_api_secret
# OR set a provider address directly:
ZG_PROVIDER_DEFAULT=0xa48f01287233509FD694a22Bf840225062E67836

# 0G Storage
ZG_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai

# AgentRegistry (deployed on 0G Galileo Testnet)
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0xB6061bC7489bDAe71cAeFd8d86A5800a78fa9bE9
```

### Run

```bash
npm run dev
# Navigate to http://localhost:3000
```

---

## Testnet Setup & Faucet Instructions

> This section is specifically for judges running the project locally.

### Step 1 — Get a Wallet & Testnet A0GI Tokens

1. Create a fresh EVM wallet (MetaMask or any compatible wallet).
2. Add the **0G Galileo Testnet** network:
   - **RPC URL:** `https://evmrpc-testnet.0g.ai`
   - **Chain ID:** `16602`
   - **Currency Symbol:** `A0GI`
3. Get free testnet A0GI from the faucet: **[0g-faucet-hackathon.vercel.app](https://0g-faucet-hackathon.vercel.app/)**
4. Export your wallet's private key and set it as `ZG_PRIVATE_KEY` in `frontend/.env.local`.

### Step 2 — Get a 0G Compute API Key

The simplest way to access 0G Compute is via the CLI secret key:
```bash
npm install -g @0gfoundation/0g-compute-cli
0g-compute-cli inference get-secret --provider 0xa48f01287233509FD694a22Bf840225062E67836 --output-file secret.json
```
Set the output values as `ZG_SERVICE_URL` and `ZG_API_SECRET` in your `.env.local`.

Alternatively, explore live providers at **[build.0g.ai/compute/providers](https://build.0g.ai/compute/providers)**.

### Step 3 — 0G Storage (No Extra Setup)

0G Storage uses your existing `ZG_PRIVATE_KEY` wallet and the public indexer:
```
ZG_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
```
No additional API key or signup required.

### Step 4 — Verify On-Chain Contracts

| Contract | Galileo Explorer |
|---|---|
| AgentRegistry | [chainscan-galileo.0g.ai/address/0xB6061...bE9](https://chainscan-galileo.0g.ai/address/0xB6061bC7489bDAe71cAeFd8d86A5800a78fa9bE9) |
| SpawnFeeVault | [chainscan-galileo.0g.ai/address/0x2196...B63](https://chainscan-galileo.0g.ai/address/0x21963748516F8a7A17d3c5864c6E28CAC080BD63) |

---


## Deployed Contracts & On-Chain Addresses

All contracts are deployed on the **0G Galileo Testnet** (Chain ID: `16602`).

### Smart Contracts

| Contract | Address |
|---|---|
| **AgentRegistry** (iNFT identity & run commits) | [`0xB6061bC7489bDAe71cAeFd8d86A5800a78fa9bE9`](https://chainscan-galileo.0g.ai/address/0xB6061bC7489bDAe71cAeFd8d86A5800a78fa9bE9) |
| **SpawnFeeVault** (OG fee collection) | [`0x21963748516F8a7A17d3c5864c6E28CAC080BD63`](https://chainscan-galileo.0g.ai/address/0x21963748516F8a7A17d3c5864c6E28CAC080BD63) |

### 0G Compute Provider

| Role | Address |
|---|---|
| **Default Inference Provider** (Qwen 2.5 7B Instruct) | `0xa48f01287233509FD694a22Bf840225062E67836` |

### 0G Storage — Agent System Prompt Root Hashes

Each agent's system prompt is permanently stored on 0G Storage. The root hashes below are the cryptographic anchors used by the `AgentRegistry` `metadataHash` verification:

| Agent | 0G Storage Root Hash |
|---|---|
| **DeFi Analyst** | `0xbacf411b30ea702d261cb7af0cff85b96667393f68cfbe332c1b0bdc4437fec7` |
| **Smart Contract Auditor** | `0xbd8b704e5a03c9e028c4ab0ce5160dd0c69bfaed4ba84a8f83d75f4d14ae833d` |
| **Tokenomics Modeler** | `0x6c4a138a736b2a1bde2a3ed0a8c4cb36d5ab599ed65e3a22058cb69ff6eea7a4` |
| **Critic** | `0xb0d1987807ea4e33d1869ff527fbdcf98f953f14660e7dd4cb17cc4ecf2e7341` |

### Network Configuration

| Parameter | Value |
|---|---|
| **Network** | 0G Galileo Testnet |
| **Chain ID** | `16602` |
| **EVM RPC** | `https://evmrpc-testnet.0g.ai` |
| **Storage Indexer RPC** | `https://indexer-storage-testnet-turbo.0g.ai` |
| **Block Explorer** | [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai) |
| **Faucet** | [0g-faucet-hackathon.vercel.app](https://0g-faucet-hackathon.vercel.app/) |

---

## Technical Stack


| Layer | Technology |
|---|---|
| **Decentralized Compute** | 0G Compute SDK (`@0gfoundation/0g-compute-ts-sdk`) |
| **Immutable Storage** | 0G Storage SDK (`@0gfoundation/0g-js-sdk`) |
| **Agent Identity** | AgentRegistry Smart Contract (on-chain) |
| **Economic Settlement** | 0G Settlement Ledger (OG tokens) |
| **Frontend Framework** | Next.js 16 (App Router, TypeScript) |
| **Wallet / Signing** | Ethers.js v6 |

---

## How 0G Makes This Possible

Orchanet required three things to exist as a trustless system:

1. **A decentralized compute layer with economic accountability** → 0G Compute + Settlement Ledger
2. **A permanent and verifiable data layer** → 0G Storage with Merkle-tree provenance
3. **An on-chain identity primitive for AI agents** → AgentRegistry smart contract

The 0G Network provided all three under a single cohesive infrastructure. Without 0G Compute, we'd be routing inference through a centralized API with no verifiability guarantees. Without 0G Storage, our run records would live in a database we control — destroying the trustless guarantee. Without the on-chain registry, agent identity would be a name string we made up.

0G is not a feature of Orchanet. It is the reason Orchanet can exist.

---

## License

MIT © 2026
