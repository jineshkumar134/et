const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(5001),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/sih_vasp'),
  ENABLE_MOCK_DB: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? true : String(val).toLowerCase() === 'true'),
    z.boolean().default(true)
  ),
  ENABLE_MOCK_BLOCKCHAIN: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? true : String(val).toLowerCase() === 'true'),
    z.boolean().default(true)
  ),
  DATA_SOURCE: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? 'mock' : String(val).toLowerCase()),
    z.string().default('mock')
  ),
  ETHERSCAN_API_KEY: z.string().optional(),
  NODE_ENV: z.string().default('development')
});

const parsedEnv = configSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

const config = {
  port: env.PORT,
  mongodbUri: env.MONGODB_URI,
  enableMockDb: env.ENABLE_MOCK_DB,
  enableMockBlockchain: env.ENABLE_MOCK_BLOCKCHAIN,
  dataSource: env.DATA_SOURCE,
  etherscanApiKey: env.ETHERSCAN_API_KEY,
  nodeEnv: env.NODE_ENV,
  analysisVersion: '1.0.0'
};

module.exports = config;
