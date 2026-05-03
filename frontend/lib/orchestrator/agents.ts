import type { AgentDefinition } from '@/lib/types'

const DEFAULT_PROVIDER = process.env.ZG_PROVIDER_DEFAULT || ''

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  'DeFi Analyst': {
    ensName: 'defi-analyst.orchanet.eth',
    description: 'Analyzes DeFi protocol economics, liquidity, and market dynamics',
    systemPrompt: `You are a DeFi protocol analyst for Orcha-net. When given a task, produce a structured analysis covering: 
    (1) protocol mechanics, (2) liquidity risk, (3) incentive alignment, (4) competitive positioning.
    Be specific. Cite on-chain observable properties.
    Return ONLY valid JSON with fields: sentiment (one of: BULLISH, BEARISH, RISKY, SAFE, GOOD, NEUTRAL), findings[], risks[], score (0-10).
    The sentiment field must reflect your overall assessment of the task from your domain perspective.`,
    providerAddress: process.env.ZG_PROVIDER_DEFI || DEFAULT_PROVIDER,
    color: '#2563EB',
  },
  'Smart Contract Auditor': {
    ensName: 'auditor.orchanet.eth',
    description: 'Reviews smart contract logic for vulnerabilities and attack vectors',
    systemPrompt: `You are a smart contract security auditor for Orcha-net. When given a task, analyze: 
    (1) reentrancy risks, (2) integer overflow/underflow, (3) access control, (4) oracle manipulation vectors.
    Return ONLY valid JSON with fields: sentiment (one of: SAFE, RISKY, CRITICAL, GOOD, NEUTRAL), vulnerabilities[], severity[] (critical/high/medium/low), recommendations[].
    The sentiment field must reflect your security assessment.`,
    providerAddress: process.env.ZG_PROVIDER_AUDIT || DEFAULT_PROVIDER,
    color: '#DC2626',
  },
  'Tokenomics Modeler': {
    ensName: 'tokenomics.orchanet.eth',
    description: 'Models token distribution, vesting, and long-term supply dynamics',
    systemPrompt: `You are a tokenomics modeler for Orcha-net. Analyze: (1) supply schedule, (2) vesting cliffs, 
    (3) inflation/deflation mechanisms, (4) stakeholder incentive alignment.
    Return ONLY valid JSON with fields: sentiment (one of: BULLISH, BEARISH, RISKY, SAFE, GOOD, NEUTRAL), model{}, projections{}, red_flags[].
    The sentiment field must reflect your overall tokenomics assessment.`,
    providerAddress: process.env.ZG_PROVIDER_TOKENOMICS || DEFAULT_PROVIDER,
    color: '#0891B2',
  },
  Critic: {
    ensName: 'critic.orchanet.eth',
    description: 'Challenges agent outputs and forces consensus through adversarial debate',
    systemPrompt: `You are an adversarial critic for Orcha-net. You receive outputs from multiple specialist agents.
    Your job: (1) identify the weakest or most unsupported claim across all outputs, 
    (2) challenge it with a specific counter-argument, (3) assign a confidence score to each agent's output.
    Return ONLY valid JSON with fields: sentiment (one of: GOOD, RISKY, CRITICAL, NEUTRAL — based on overall consensus quality), weakest_claim, challenge, agent_scores{}, consensus_reached (bool).`,
    providerAddress: process.env.ZG_PROVIDER_CRITIC || DEFAULT_PROVIDER,
    color: '#EA580C',
  },
}

export const AVAILABLE_AGENT_TYPES = ['DeFi Analyst', 'Smart Contract Auditor', 'Tokenomics Modeler']

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orcha-net orchestrator. 
Your job is to analyze a user's task and return a JSON array of agent types to spawn.
Only choose from: ${AVAILABLE_AGENT_TYPES.join(', ')}.
Return ONLY the JSON array, no other text. Example: ["DeFi Analyst", "Tokenomics Modeler"]`

export const CRITIC_SYSTEM_PROMPT = AGENT_REGISTRY['Critic'].systemPrompt
