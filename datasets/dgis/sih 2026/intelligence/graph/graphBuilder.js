const TransactionGraph = require('./graph');

class GraphBuilder {
  /**
   * Builds a TransactionGraph from an array of normalized transaction objects
   * @param {Array<Object>} transactions
   * @returns {TransactionGraph}
   */
  static buildGraph(transactions = []) {
    const graph = new TransactionGraph();

    if (!Array.isArray(transactions)) {
      return graph;
    }

    for (const tx of transactions) {
      if (tx && tx.from && tx.to && tx.txHash) {
        graph.addEdge(tx);
      }
    }

    return graph;
  }
}

module.exports = GraphBuilder;
