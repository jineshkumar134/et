const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/config');
const { connectDb } = require('./config/db');
const apiRoutes = require('./routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(cors());

// Request logging (suppress in test mode)
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing middleware with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount API v1 routes
app.use('/api/v1', apiRoutes);

// Centralized 404 Not Found Handler
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

let server = null;

/**
 * Start the Express server and attempt DB initialization
 */
async function startServer() {
  // Attempt DB connection (graceful fallback to mock DB if unavailable)
  await connectDb();

  // Seed demo VASP intelligence records
  try {
    const seedData = require('./scripts/seed');
    await seedData();
  } catch (seedErr) {
    console.warn('[Server] Auto-seed warning:', seedErr.message);
  }

  return new Promise((resolve) => {
    server = app.listen(config.port, () => {
      if (config.nodeEnv !== 'test') {
        console.log(`==================================================`);
        console.log(` BIVAE SIH 2026 LEA Investigation Backend`);
        console.log(` Server running on port: ${config.port}`);
        console.log(` API Base URL: http://localhost:${config.port}/api/v1`);
        console.log(` Health Check: http://localhost:${config.port}/api/v1/health`);
        console.log(`==================================================`);
      }
      resolve({ app, server });
    });
  });
}

// Automatically start server when executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, getServer: () => server };
