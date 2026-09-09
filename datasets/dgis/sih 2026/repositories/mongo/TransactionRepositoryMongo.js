const Transaction = require('../../models/Transaction');

class TransactionRepositoryMongo {
  async create(data) {
    const doc = new Transaction(data);
    return await doc.save();
  }

  async findByHash(chain, txHash) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedHash = String(txHash).toLowerCase();
    return await Transaction.findOne({ chain: normalizedChain, txHash: normalizedHash }).lean();
  }

  async findByAddress(chain, address, options = {}) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(address).toLowerCase();
    const limit = options.limit || 100;

    return await Transaction.find({
      chain: normalizedChain,
      $or: [{ from: normalizedAddress }, { to: normalizedAddress }]
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  async findOutgoing(chain, fromAddress, options = {}) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(fromAddress).toLowerCase();
    const limit = options.limit || 100;

    return await Transaction.find({ chain: normalizedChain, from: normalizedAddress })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  async findIncoming(chain, toAddress, options = {}) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(toAddress).toLowerCase();
    const limit = options.limit || 100;

    return await Transaction.find({ chain: normalizedChain, to: normalizedAddress })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  async clear() {
    return await Transaction.deleteMany({});
  }
}

module.exports = TransactionRepositoryMongo;
