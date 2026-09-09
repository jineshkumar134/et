/**
 * Creates structured, JSON-serializable Trace Result object
 */
function createTraceResult({
  startAddress,
  chain,
  maxDepth,
  maxTransactions,
  timeWindowHours,
  visitedNodes = [],
  processedTransactions = 0,
  paths = [],
  graphData = { nodes: [], edges: [] },
  maxDepthReached = 0,
  edgesTraversed = 0
}) {
  return {
    startAddress: String(startAddress).toLowerCase(),
    chain: String(chain).toLowerCase(),
    maxDepth: Number(maxDepth),
    maxTransactions: Number(maxTransactions),
    timeWindowHours: Number(timeWindowHours),
    visitedNodes: visitedNodes.map(n => String(n).toLowerCase()),
    processedTransactions: Number(processedTransactions),
    paths: paths,
    graph: graphData,
    stats: {
      nodesVisited: visitedNodes.length,
      edgesTraversed: Number(edgesTraversed),
      pathsFound: paths.length,
      maxDepthReached: Number(maxDepthReached),
      transactionsProcessed: Number(processedTransactions)
    }
  };
}

module.exports = {
  createTraceResult
};
