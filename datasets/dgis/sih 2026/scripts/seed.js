const { connectDb } = require('../config/db');
const repositories = require('../repositories');

const syntheticVaspRecords = [
  {
    vaspId: 'VASP_DEMO_A',
    name: 'Exchange Demo A',
    vasp: 'Exchange Demo A',
    type: 'CEX',
    jurisdiction: 'IN',
    address: '0x1111111111111111111111111111111111111111',
    chain: 'ETH',
    walletType: 'DEPOSIT_WALLET',
    attributionType: 'DIRECT',
    confidence: 95,
    sourceType: 'SYNTHETIC_DEMO',
    isSynthetic: true,
    clusterId: 'CLUSTER_DEMO_A',
    leaContactEmail: 'compliance@demo-exchange-a.test',
    subpoenaGuide: 'Submit LEA Subpoena Portal Form A-1',
    tags: ['EXCHANGE', 'DEPOSIT', 'INDIAN_JURISDICTION']
  },
  {
    vaspId: 'VASP_DEMO_B',
    name: 'Exchange Demo B',
    vasp: 'Exchange Demo B',
    type: 'CEX',
    jurisdiction: 'US',
    address: '0x2222222222222222222222222222222222222222',
    chain: 'ETH',
    walletType: 'HOT_WALLET',
    attributionType: 'CLUSTER',
    confidence: 80,
    sourceType: 'SYNTHETIC_DEMO',
    isSynthetic: true,
    clusterId: 'CLUSTER_DEMO_B',
    leaContactEmail: 'lea@demo-exchange-b.test',
    subpoenaGuide: 'Submit US Law Enforcement Portal Request',
    tags: ['EXCHANGE', 'HOT_WALLET', 'GLOBAL']
  },
  {
    vaspId: 'VASP_DEMO_C',
    name: 'Exchange Demo C',
    vasp: 'Exchange Demo C',
    type: 'CEX',
    jurisdiction: 'SG',
    address: '0x3333333333333333333333333333333333333333',
    chain: 'ETH',
    walletType: 'EXCHANGE_CLUSTER',
    attributionType: 'HEURISTIC',
    confidence: 75,
    sourceType: 'SYNTHETIC_DEMO',
    isSynthetic: true,
    clusterId: 'CLUSTER_DEMO_C',
    leaContactEmail: 'legal@demo-exchange-c.test',
    subpoenaGuide: 'Send email with signed judicial warrant',
    tags: ['EXCHANGE', 'CLUSTER']
  },
  {
    vaspId: 'VASP_DEMO_D',
    name: 'Exchange Demo D',
    vasp: 'Exchange Demo D',
    type: 'CEX',
    jurisdiction: 'EU',
    address: '0x4444444444444444444444444444444444444444',
    chain: 'ETH',
    walletType: 'COLD_WALLET',
    attributionType: 'CLUSTER',
    confidence: 90,
    sourceType: 'SYNTHETIC_DEMO',
    isSynthetic: true,
    clusterId: 'CLUSTER_DEMO_D',
    leaContactEmail: 'compliance@demo-exchange-d.test',
    subpoenaGuide: 'Submit EU LEA Contact Form',
    tags: ['EXCHANGE', 'COLD_STORAGE']
  }
];

async function seedData() {
  console.log('==================================================');
  console.log(' SEEDING SYNTHETIC DEMO VASP INTELLIGENCE DATA');
  console.log('==================================================\n');

  // Attempt database connection
  await connectDb();

  const vaspRepo = repositories.vaspRepository;
  const walletIntelRepo = repositories.walletIntelligenceRepository;

  let seededVaspCount = 0;
  let seededIntelCount = 0;

  for (const record of syntheticVaspRecords) {
    try {
      const existingVasp = await vaspRepo.findByChainAndAddress(record.chain, record.address);
      if (!existingVasp) {
        await vaspRepo.create(record);
        console.log(`[Seed] Created synthetic VASP record: ${record.name} (${record.address})`);
        seededVaspCount++;
      }

      const existingIntel = await walletIntelRepo.findByChainAndAddress(record.chain, record.address);
      if (!existingIntel) {
        await walletIntelRepo.create({
          address: record.address,
          chain: record.chain,
          entityName: record.name,
          walletType: record.walletType,
          entityType: 'VASP',
          clusterId: record.clusterId,
          confidence: record.confidence,
          sourceType: record.sourceType,
          isSynthetic: true,
          tags: record.tags
        });
        seededIntelCount++;
      }
    } catch (err) {
      console.warn(`[Seed] Could not seed ${record.name}: ${err.message}`);
    }
  }

  console.log(`\n[Seed] Successfully seeded ${seededVaspCount} VASP records & ${seededIntelCount} WalletIntelligence records.`);
  console.log('==================================================\n');

  return seededVaspCount;
}

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}

module.exports = seedData;
