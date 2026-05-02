// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentRegistry
 * @notice Orcha-net on-chain agent registry and run commitment ledger.
 *         Designed for deployment on 0G Galileo Testnet (chainId 16602).
 *
 * @dev ERC-7857-inspired: each agent is a tokenised NFT-like entity with:
 *      - Immutable metadata hash (keccak256 of system prompt + capabilities)
 *      - 0G Storage root hash (where full agent data lives)
 *      - ENS-style subname for human-readable identity
 *      - Authorised callers for agent-to-agent delegation
 *
 * RPC:      https://evmrpc-testnet.0g.ai
 * Explorer: https://chainscan-galileo.0g.ai
 * Storage:  https://storagescan.0g.ai
 */

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface IAgentRegistry {
    event AgentRegistered(
        uint256 indexed tokenId,
        string agentType,
        string ensName,
        bytes32 metadataHash,
        string storageRootHash
    );
    event AgentAuthorized(uint256 indexed tokenId, address indexed caller);
    event AgentAuthorizationRevoked(uint256 indexed tokenId, address indexed caller);
    event RunCommitted(
        uint256 indexed runIndex,
        string runId,
        bytes32 rootHash,
        uint256 agentsSpawned,
        uint256 timestamp
    );
    event AgentSpawned(uint256 indexed tokenId, string runId, uint256 spawnCount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
}

// ─── Contract ──────────────────────────────────────────────────────────────────

contract AgentRegistry is IAgentRegistry {

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Agent {
        uint256  tokenId;
        string   agentType;
        string   ensName;
        bytes32  metadataHash;     // keccak256(systemPrompt || capabilities)
        string   storageRootHash;  // 0G Storage root hash of full agent JSON
        address  owner;
        uint256  spawnCount;
        uint256  registeredAt;
        bool     active;
    }

    struct Run {
        string   runId;
        bytes32  rootHash;          // 0G Storage root hash of run record JSON
        uint256  agentsSpawned;
        uint256  timestamp;
        address  initiator;         // who triggered the run
    }

    // ── State ─────────────────────────────────────────────────────────────────

    uint256 public nextTokenId;
    mapping(uint256 => Agent)   public agents;
    mapping(string  => uint256) public agentTypeToTokenId;

    // ERC-7857-style authorisation: tokenId => authorized caller
    mapping(uint256 => mapping(address => bool)) public authorized;
    // max 100 authorized users per token
    mapping(uint256 => address[]) private _authorizedList;

    Run[] public runs;
    mapping(string => uint256) public runIdToIndex;  // runId => runs[] index + 1 (0 = not found)

    address public owner;

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentRegistry: not owner");
        _;
    }

    modifier onlyOwnerOrAuthorized(uint256 tokenId) {
        require(
            msg.sender == owner ||
            msg.sender == agents[tokenId].owner ||
            authorized[tokenId][msg.sender],
            "AgentRegistry: not authorized"
        );
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AgentRegistry: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── Agent Registration ────────────────────────────────────────────────────

    /**
     * @notice Register an agent on-chain. Only callable by the owner.
     * @param agentType       Human-readable agent type (e.g. "DeFi Analyst")
     * @param ensName         ENS-style subname (e.g. "defi-analyst.orchanet.eth")
     * @param storageRootHash 0G Storage root hash where full agent JSON is stored
     * @return tokenId        The newly minted token ID
     */
    function registerAgent(
        string calldata agentType,
        string calldata ensName,
        string calldata storageRootHash
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        bytes32 metadataHash = keccak256(abi.encodePacked(agentType, ensName, storageRootHash));

        agents[tokenId] = Agent({
            tokenId:         tokenId,
            agentType:       agentType,
            ensName:         ensName,
            metadataHash:    metadataHash,
            storageRootHash: storageRootHash,
            owner:           msg.sender,
            spawnCount:      0,
            registeredAt:    block.timestamp,
            active:          true
        });

        agentTypeToTokenId[agentType] = tokenId;

        emit AgentRegistered(tokenId, agentType, ensName, metadataHash, storageRootHash);
    }

    /**
     * @notice Update the storage root hash for an agent (e.g. after model update).
     */
    function updateStorageRootHash(
        uint256 tokenId,
        string calldata newRootHash
    ) external onlyOwner {
        require(tokenId < nextTokenId, "AgentRegistry: token does not exist");
        agents[tokenId].storageRootHash = newRootHash;
        agents[tokenId].metadataHash = keccak256(
            abi.encodePacked(agents[tokenId].agentType, agents[tokenId].ensName, newRootHash)
        );
    }

    // ── Authorisation (ERC-7857 delegation) ──────────────────────────────────

    function authorizeUsage(uint256 tokenId, address caller) external onlyOwnerOrAuthorized(tokenId) {
        require(!authorized[tokenId][caller], "AgentRegistry: already authorized");
        require(_authorizedList[tokenId].length < 100, "AgentRegistry: max authorizations reached");
        authorized[tokenId][caller] = true;
        _authorizedList[tokenId].push(caller);
        emit AgentAuthorized(tokenId, caller);
    }

    function revokeAuthorization(uint256 tokenId, address caller) external onlyOwnerOrAuthorized(tokenId) {
        authorized[tokenId][caller] = false;
        emit AgentAuthorizationRevoked(tokenId, caller);
    }

    // ── Run Commitment ────────────────────────────────────────────────────────

    /**
     * @notice Commit a completed orchestration run on-chain.
     * @param runId              Unique run identifier (UUID)
     * @param rootHash           0G Storage root hash of the full run record JSON
     * @param agentTypesSpawned  Array of agent type strings that participated
     */
    function commitRun(
        string calldata runId,
        bytes32 rootHash,
        string[] calldata agentTypesSpawned
    ) external {
        require(runIdToIndex[runId] == 0, "AgentRegistry: run already committed");
        require(agentTypesSpawned.length > 0, "AgentRegistry: no agents specified");

        // Update spawn counts
        for (uint256 i = 0; i < agentTypesSpawned.length; i++) {
            uint256 tid = agentTypeToTokenId[agentTypesSpawned[i]];
            // Only increment if the agent is registered (token 0 exists so check active flag)
            if (agents[tid].active) {
                agents[tid].spawnCount++;
                emit AgentSpawned(tid, runId, agents[tid].spawnCount);
            }
        }

        uint256 runIndex = runs.length;
        runs.push(Run({
            runId:         runId,
            rootHash:      rootHash,
            agentsSpawned: agentTypesSpawned.length,
            timestamp:     block.timestamp,
            initiator:     msg.sender
        }));

        // Store 1-indexed so that 0 means "not found"
        runIdToIndex[runId] = runIndex + 1;

        emit RunCommitted(runIndex, runId, rootHash, agentTypesSpawned.length, block.timestamp);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    function getAgent(uint256 tokenId) external view returns (Agent memory) {
        require(tokenId < nextTokenId, "AgentRegistry: token does not exist");
        return agents[tokenId];
    }

    function getAgentByType(string calldata agentType) external view returns (Agent memory) {
        return agents[agentTypeToTokenId[agentType]];
    }

    function getRunCount() external view returns (uint256) {
        return runs.length;
    }

    function getRun(uint256 index) external view returns (Run memory) {
        require(index < runs.length, "AgentRegistry: run index out of bounds");
        return runs[index];
    }

    function getRunByRunId(string calldata runId) external view returns (Run memory, uint256 index) {
        uint256 idx = runIdToIndex[runId];
        require(idx > 0, "AgentRegistry: run not found");
        index = idx - 1;
        return (runs[index], index);
    }

    function totalAgents() external view returns (uint256) {
        return nextTokenId;
    }

    function getAuthorizedList(uint256 tokenId) external view returns (address[] memory) {
        return _authorizedList[tokenId];
    }

    /** @notice Returns all registered agents as an array */
    function getAllAgents() external view returns (Agent[] memory) {
        Agent[] memory result = new Agent[](nextTokenId);
        for (uint256 i = 0; i < nextTokenId; i++) {
            result[i] = agents[i];
        }
        return result;
    }

    /** @notice Returns recent runs (last N) */
    function getRecentRuns(uint256 n) external view returns (Run[] memory) {
        uint256 count = runs.length < n ? runs.length : n;
        Run[] memory result = new Run[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = runs[runs.length - count + i];
        }
        return result;
    }
}
