const { normalizedTransactionSchema } = require('./schemas');

/**
 * Precision-safe conversion of raw token amounts to decimal string
 * Avoids unsafe JavaScript floating point operations.
 */
function parseTokenAmount(rawAmount, decimals = 18) {
  if (!rawAmount) return '0';
  const str = String(rawAmount).trim();

  // If amount already contains decimal point, return clean string
  if (str.includes('.')) {
    return str;
  }

  try {
    const bigRaw = BigInt(str);
    if (decimals === 0) return bigRaw.toString();

    const base = BigInt(10) ** BigInt(decimals);
    const integerPart = (bigRaw / base).toString();
    const remainder = (bigRaw % base).toString().padStart(decimals, '0');

    // Trim trailing zeroes from remainder
    const trimmedRemainder = remainder.replace(/0+$/, '');

    if (trimmedRemainder.length === 0) {
      return integerPart;
    }
    return `${integerPart}.${trimmedRemainder}`;
  } catch (err) {
    return str; // Fallback to raw string if not integer BigInt
  }
}

/**
 * Normalizes raw transaction or token transfer into standard project transaction format
 * @param {Object} rawTx - Raw transaction object from adapter
 * @param {string} [queriedAddress] - Optional target wallet address for direction calculation
 * @returns {Object} Normalized transaction object
 */
function normalizeTransaction(rawTx, queriedAddress = null) {
  if (!rawTx || typeof rawTx !== 'object') {
    throw new Error('Invalid raw transaction payload provided for normalization');
  }

  const fromAddress = String(rawTx.from || '').trim().toLowerCase();
  const toAddress = String(rawTx.to || '').trim().toLowerCase();
  const targetAddress = queriedAddress ? String(queriedAddress).trim().toLowerCase() : null;

  // Calculate direction relative to queried wallet address
  let direction = 'UNKNOWN';
  if (targetAddress) {
    if (fromAddress === targetAddress) {
      direction = 'OUTGOING';
    } else if (toAddress === targetAddress) {
      direction = 'INCOMING';
    }
  } else if (rawTx.direction) {
    direction = rawTx.direction;
  }

  // Determine asset, token contract, and amount
  let asset = rawTx.asset || rawTx.tokenSymbol || 'ETH';
  let tokenContract = rawTx.tokenContract || null;
  let amountStr = '0';

  if (rawTx.tokenAmount !== undefined && rawTx.tokenDecimals !== undefined) {
    asset = rawTx.tokenSymbol || 'TOKEN';
    tokenContract = rawTx.tokenContract || null;
    amountStr = parseTokenAmount(rawTx.tokenAmount, rawTx.tokenDecimals);
  } else if (rawTx.amount !== undefined) {
    amountStr = String(rawTx.amount);
  } else if (rawTx.value !== undefined) {
    amountStr = String(rawTx.value);
  }

  // Ensure valid ISO 8601 timestamp string
  let isoTimestamp = new Date().toISOString();
  if (rawTx.timestamp) {
    const parsedDate = new Date(rawTx.timestamp);
    if (!isNaN(parsedDate.getTime())) {
      isoTimestamp = parsedDate.toISOString();
    }
  }

  const normalized = {
    chain: String(rawTx.chain || 'ethereum').toLowerCase(),
    txHash: String(rawTx.txHash || rawTx.hash || '').toLowerCase(),
    from: fromAddress,
    to: toAddress,
    amount: amountStr,
    asset: String(asset).toUpperCase(),
    tokenContract: tokenContract ? String(tokenContract).toLowerCase() : null,
    timestamp: isoTimestamp,
    blockNumber: Number(rawTx.blockNumber || 0),
    direction: direction,
    dataSource: rawTx.dataSource || 'SYNTHETIC_BLOCKCHAIN_DATA',
    isSynthetic: rawTx.isSynthetic !== undefined ? Boolean(rawTx.isSynthetic) : true,
    metadata: rawTx.metadata || {}
  };

  // Validate against Zod schema
  const validation = normalizedTransactionSchema.safeParse(normalized);

  if (!validation.success) {
    const errorMessages = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Transaction normalization validation failed: ${errorMessages}`);
  }

  return validation.data;
}

module.exports = {
  normalizeTransaction,
  parseTokenAmount
};
