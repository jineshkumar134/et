/**
 * Graph Abstraction for Cryptocurrency Wallet & Transaction Network
 * WALLETS = NODES, TRANSACTIONS = EDGES
 */
class TransactionGraph {
  constructor() {
    this.nodes = new Map(); // key: chain:normalizedAddress
    this.edges = [];        // list of transaction edges
    this.edgeMap = new Map(); // key: chain:txHash -> edge
    this.outgoing = new Map(); // key: nodeId -> list of outgoing edges
    this.incoming = new Map(); // key: nodeId -> list of incoming edges
  }

  /**
   * Deterministic Node ID helper (e.g. 'ethereum:0xaaaaaaaa...')
   */
  static makeNodeId(chain, address) {
    const c = String(chain || 'ethereum').toLowerCase();
    const a = String(address || '').trim().toLowerCase();
    return `${c}:${a}`;
  }

  /**
   * Adds or returns an existing wallet node in the graph
   */
  addNode(chain, address, metadata = {}) {
    const nodeId = TransactionGraph.makeNodeId(chain, address);
    if (!this.nodes.has(nodeId)) {
      const node = {
        id: nodeId,
        address: String(address).trim().toLowerCase(),
        chain: String(chain).toLowerCase(),
        walletType: metadata.walletType || 'UNKNOWN',
        metadata: metadata
      };
      this.nodes.set(nodeId, node);
      this.outgoing.set(nodeId, []);
      this.incoming.set(nodeId, []);
    }
    return this.nodes.get(nodeId);
  }

  /**
   * Adds a transaction edge to the graph (creates endpoint nodes automatically).
   * Prevents duplicate edges with the same txHash.
   */
  addEdge(tx) {
    if (!tx || !tx.from || !tx.to || !tx.txHash) {
      return null;
    }

    const chainStr = String(tx.chain || 'ethereum').toLowerCase();
    const hashStr = String(tx.txHash).toLowerCase();
    const edgeKey = `${chainStr}:${hashStr}`;

    if (this.edgeMap.has(edgeKey)) {
      return this.edgeMap.get(edgeKey);
    }

    const sourceNode = this.addNode(chainStr, tx.from);
    const targetNode = this.addNode(chainStr, tx.to);

    const edge = {
      id: hashStr,
      txHash: hashStr,
      source: sourceNode.id,
      target: targetNode.id,
      from: sourceNode.address,
      to: targetNode.address,
      chain: chainStr,
      amount: String(tx.amount),
      asset: String(tx.asset || 'ETH').toUpperCase(),
      tokenContract: tx.tokenContract || null,
      timestamp: tx.timestamp,
      blockNumber: Number(tx.blockNumber || 0),
      dataSource: tx.dataSource || 'SYNTHETIC_BLOCKCHAIN_DATA',
      isSynthetic: tx.isSynthetic !== undefined ? Boolean(tx.isSynthetic) : true,
      metadata: tx.metadata || {}
    };

    this.edges.push(edge);
    this.edgeMap.set(edgeKey, edge);
    this.outgoing.get(sourceNode.id).push(edge);
    this.incoming.get(targetNode.id).push(edge);

    return edge;
  }

  getNode(chain, address) {
    const nodeId = TransactionGraph.makeNodeId(chain, address);
    return this.nodes.get(nodeId) || null;
  }

  getNodeById(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  getOutgoingEdges(nodeId) {
    return this.outgoing.get(nodeId) || [];
  }

  getIncomingEdges(nodeId) {
    return this.incoming.get(nodeId) || [];
  }

  /**
   * Convert graph representation to JSON-serializable structure
   */
  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges.map(e => ({ ...e }))
    };
  }
}

module.exports = TransactionGraph;
