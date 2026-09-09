const { z } = require('zod');

/**
 * Zod Schema for Normalized Blockchain Transaction
 */
const normalizedTransactionSchema = z.object({
  chain: z.string().min(1),
  txHash: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.string().min(1),
  asset: z.string().min(1),
  tokenContract: z.string().nullable().optional().default(null),
  timestamp: z.string().datetime().or(z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid timestamp' })),
  blockNumber: z.number().int().nonnegative(),
  direction: z.enum(['OUTGOING', 'INCOMING', 'UNKNOWN']).default('UNKNOWN'),
  dataSource: z.string().default('SYNTHETIC_BLOCKCHAIN_DATA'),
  isSynthetic: z.boolean().default(true),
  metadata: z.record(z.any()).optional().default({})
});

module.exports = {
  normalizedTransactionSchema
};
