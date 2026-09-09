const mongoose = require('mongoose');
const config = require('./config');

let dbStatus = 'NOT_INITIALIZED';

/**
 * Initialize MongoDB database connection gracefully.
 * Does not throw or crash the app if MongoDB is unavailable.
 */
async function connectDb() {
  try {
    // Short timeout for server selection so startup isn't delayed if MongoDB is down
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 2500,
    });
    dbStatus = 'CONNECTED';
    console.log(`[Database] Connected successfully to MongoDB (${config.mongodbUri})`);
  } catch (error) {
    if (config.enableMockDb) {
      dbStatus = 'MOCK';
      console.warn(`[Database] MongoDB connection unavailable (${error.message}). Running in MOCK DB mode.`);
    } else {
      dbStatus = 'DOWN';
      console.error(`[Database] MongoDB connection failed (${error.message}). Mock DB mode disabled.`);
    }
  }

  // Handle runtime connection disconnects
  mongoose.connection.on('disconnected', () => {
    if (dbStatus === 'CONNECTED') {
      dbStatus = config.enableMockDb ? 'MOCK' : 'DOWN';
      console.warn('[Database] MongoDB connection lost.');
    }
  });

  return dbStatus;
}

/**
 * Returns current database connection status string.
 * @returns {'CONNECTED' | 'MOCK' | 'DOWN' | 'NOT_INITIALIZED'}
 */
function getDbStatus() {
  if (dbStatus === 'NOT_INITIALIZED' || dbStatus === 'DOWN') {
    if (config.enableMockDb) {
      return 'MOCK';
    }
  }
  return dbStatus;
}

module.exports = {
  connectDb,
  getDbStatus
};
