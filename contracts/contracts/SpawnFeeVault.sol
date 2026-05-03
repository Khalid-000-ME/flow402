// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SpawnFeeVault
 * @notice On-chain fee distribution for Orcha-net agents.
 *
 * Flow (direct-transfer model):
 *   Orchestrator calls depositAndBatchPay() with:
 *     - owners[]    — agent owner addresses
 *     - amounts[]   — OG share per owner (wei)
 *     - agentTypes[] — human-readable agent labels
 *     - runId       — unique run identifier
 *   The vault immediately forwards OG to each owner wallet and emits
 *   FeeDistributed per agent, creating an auditable on-chain record.
 *
 * Why a contract instead of direct transfers?
 *   - Single atomic transaction covering all agents
 *   - On-chain event log (FeeDistributed) queryable by any indexer
 *   - RunFeeSettled event provides a per-run summary
 *   - Orchestrator address is verified on-chain
 */
contract SpawnFeeVault {

    address public orchestrator;

    uint256 public totalRuns;
    uint256 public totalPaidWei;

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted for each individual agent owner payment
    event FeeDistributed(
        address indexed owner,
        uint256 amount,
        string  agentType,
        string  runId
    );

    /// @notice Emitted once per run as a summary
    event RunFeeSettled(
        string  indexed runId,
        uint256 totalAmount,
        uint256 agentCount
    );

    event OrchestratorChanged(address indexed previous, address indexed next);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _orchestrator) {
        require(_orchestrator != address(0), "SpawnFeeVault: zero address");
        orchestrator = _orchestrator;
    }

    // ── Modifier ──────────────────────────────────────────────────────────────

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "SpawnFeeVault: not orchestrator");
        _;
    }

    // ── Core: deposit + pay all owners atomically ─────────────────────────────

    /**
     * @notice  Deposit OG and immediately forward shares to each agent owner.
     * @dev     msg.value must equal the sum of amounts[]. Any excess is
     *          returned to the caller.  OG is forwarded using .call{value}
     *          which is safe for EOA recipients and non-reentrant contracts.
     *          If any individual transfer fails, the entire transaction reverts,
     *          so either all agents are paid or none are.
     *
     * @param owners     Agent owner wallet addresses
     * @param amounts    OG share in wei for each owner
     * @param agentTypes Human-readable agent labels (for event log)
     * @param runId      Unique run identifier (for event log)
     */
    function depositAndBatchPay(
        address[] calldata owners,
        uint256[] calldata amounts,
        string[]  calldata agentTypes,
        string    calldata runId
    ) external payable onlyOrchestrator {
        uint256 n = owners.length;
        require(n > 0,                       "SpawnFeeVault: empty");
        require(n == amounts.length,         "SpawnFeeVault: length mismatch a");
        require(n == agentTypes.length,      "SpawnFeeVault: length mismatch b");

        // Verify total deposit covers all payments
        uint256 total = 0;
        for (uint256 i = 0; i < n; i++) total += amounts[i];
        require(msg.value >= total, "SpawnFeeVault: insufficient OG");

        // Forward OG to each owner immediately
        for (uint256 i = 0; i < n; i++) {
            (bool ok, ) = payable(owners[i]).call{value: amounts[i]}("");
            require(ok, "SpawnFeeVault: transfer failed");
            emit FeeDistributed(owners[i], amounts[i], agentTypes[i], runId);
        }

        // Emit run summary
        emit RunFeeSettled(runId, total, n);

        totalRuns    += 1;
        totalPaidWei += total;

        // Return any excess OG to orchestrator
        uint256 excess = msg.value - total;
        if (excess > 0) {
            (bool ok2, ) = payable(msg.sender).call{value: excess}("");
            require(ok2, "SpawnFeeVault: excess return failed");
        }
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function changeOrchestrator(address newOrchestrator) external onlyOrchestrator {
        require(newOrchestrator != address(0), "SpawnFeeVault: zero address");
        emit OrchestratorChanged(orchestrator, newOrchestrator);
        orchestrator = newOrchestrator;
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Drain any accidentally-sent OG to orchestrator
    function drain() external onlyOrchestrator {
        uint256 bal = address(this).balance;
        require(bal > 0, "SpawnFeeVault: empty");
        (bool ok, ) = payable(orchestrator).call{value: bal}("");
        require(ok, "SpawnFeeVault: drain failed");
    }

    /// @notice Accept plain OG transfers (e.g., initial seed)
    receive() external payable {}
}
