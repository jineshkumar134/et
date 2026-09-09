const TransactionGraph = require('../graph/graph');
const { createTraceResult } = require('./traceResult');

class BFSTracer {
  /**
   * Executes Breadth-First Search multi-hop wallet tracing
   * @param {Object} params
   * @param {string} params.chain - Blockchain network
   * @param {string} params.startAddress - Starting suspect wallet address
   * @param {number} [params.maxDepth=5] - Maximum traversal depth
   * @param {number} [params.maxTransactions=100] - Maximum transactions to process
   * @param {number} [params.timeWindowHours=24] - Investigation time window in hours
   * @param {Function} [params.fetchTransactions] - Async function (chain, address) => normalizedTxs
   * @param {Array<Object>} [params.preloadedTransactions] - Pre-fetched normalized transactions
   * @returns {Promise<Object>} Structured Trace Result
   */
  static async trace({
    chain = 'ethereum',
    startAddress,
    maxDepth = 5,
    maxTransactions = 100,
    timeWindowHours = 24,
    fetchTransactions = null,
    preloadedTransactions = null
  }) {
    if (!startAddress) {
      throw new Error('startAddress is required for BFS tracing');
    }

    const normChain = String(chain).toLowerCase();
    const normStart = String(startAddress).trim().toLowerCase();
    const limitDepth = Math.max(1, Number(maxDepth) || 5);
    const limitTxs = Math.max(1, Number(maxTransactions) || 100);
    const limitHours = Math.max(0, Number(timeWindowHours) || 24);

    const startNodeId = TransactionGraph.makeNodeId(normChain, normStart);
    const graph = new TransactionGraph();

    // Cache of fetched wallet addresses
    const fetchedWallets = new Set();

    // Helper to load wallet transactions safely
    async function loadWalletTransactions(addr) {
      const lower = String(addr || '').toLowerCase();
      if (!lower || fetchedWallets.has(lower)) return;
      fetchedWallets.add(lower);

      let txs = [];
      if (preloadedTransactions && Array.isArray(preloadedTransactions)) {
        txs = preloadedTransactions.filter(
          (t) =>
            t &&
            t.from &&
            t.to &&
            (String(t.from).toLowerCase() === lower || String(t.to).toLowerCase() === lower)
        );
      } else if (fetchTransactions && typeof fetchTransactions === 'function') {
        txs = await fetchTransactions(normChain, lower);
      }

      for (const t of txs) {
        if (t && t.from && t.to && t.txHash) {
          graph.addEdge(t);
        }
      }
    }

    // Load initial wallet transactions
    await loadWalletTransactions(normStart);

    // Enforce initial node creation
    graph.addNode(normChain, normStart);

    // BFS Queue & Visited state
    const queue = [];
    const visitedNodeIds = new Set([startNodeId]);
    const visitedAddresses = new Set([normStart]);
    const paths = [];

    let processedTxsCount = 0;
    let edgesTraversedCount = 0;
    let maxDepthReached = 0;

    // Determine reference timestamp for time window filtering
    const initialEdges = graph.getOutgoingEdges(startNodeId);
    let referenceTimeMs = null;
    if (initialEdges.length > 0) {
      const sortedInitial = [...initialEdges].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      referenceTimeMs = new Date(sortedInitial[0].timestamp).getTime();
    }

    queue.push({
      nodeId: startNodeId,
      address: normStart,
      currentPath: [normStart],
      currentTxPath: [],
      depth: 0
    });

    while (queue.length > 0 && processedTxsCount < limitTxs) {
      const current = queue.shift();
      const { nodeId, address, currentPath, currentTxPath, depth } = current;

      if (depth > maxDepthReached) {
        maxDepthReached = depth;
      }

      // Check max depth constraint
      if (depth >= limitDepth) {
        continue;
      }

      // Ensure target wallet transactions are loaded into graph
      await loadWalletTransactions(address);

      // Fetch outgoing edges from current node
      let outgoingEdges = [...graph.getOutgoingEdges(nodeId)];

      // Sort outgoing edges deterministically
      outgoingEdges.sort((a, b) => {
        const timeDiff = new Date(a.timestamp) - new Date(b.timestamp);
        if (timeDiff !== 0) return timeDiff;
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        return a.txHash.localeCompare(b.txHash);
      });

      for (const edge of outgoingEdges) {
        if (processedTxsCount >= limitTxs) {
          break;
        }

        // Time window filter check
        if (referenceTimeMs && limitHours > 0) {
          const edgeTimeMs = new Date(edge.timestamp).getTime();
          const hourDiff = Math.abs(edgeTimeMs - referenceTimeMs) / (1000 * 60 * 60);
          if (hourDiff > limitHours) {
            continue; // Skip transactions outside time window
          }
        }

        processedTxsCount++;
        edgesTraversedCount++;

        const targetAddress = edge.to;
        const targetNodeId = TransactionGraph.makeNodeId(normChain, targetAddress);

        const newPathNodes = [...currentPath, targetAddress];
        const newTxPath = [...currentTxPath, edge.txHash];
        const newDepth = depth + 1;

        // Record path
        paths.push({
          nodes: newPathNodes,
          transactions: newTxPath,
          depth: newDepth
        });

        // Cycle Prevention & Queue Enqueue
        if (!visitedNodeIds.has(targetNodeId)) {
          visitedNodeIds.add(targetNodeId);
          visitedAddresses.add(targetAddress);

          queue.push({
            nodeId: targetNodeId,
            address: targetAddress,
            currentPath: newPathNodes,
            currentTxPath: newTxPath,
            depth: newDepth
          });
        }
      }
    }

    return createTraceResult({
      startAddress: normStart,
      chain: normChain,
      maxDepth: limitDepth,
      maxTransactions: limitTxs,
      timeWindowHours: limitHours,
      visitedNodes: Array.from(visitedAddresses),
      processedTransactions: processedTxsCount,
      paths: paths,
      graphData: graph.toJSON(),
      maxDepthReached: maxDepthReached,
      edgesTraversed: edgesTraversedCount
    });
  }
}

module.exports = BFSTracer;
