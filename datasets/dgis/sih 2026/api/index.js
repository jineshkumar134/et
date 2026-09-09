// api/index.js
// Vercel Serverless Function entrypoint for Express backend
const { app } = require('../server');
const { connectDb } = require('../config/db');
const seedData = require('../scripts/seed');

let isInitialized = false;

module.exports = async (req, res) => {
  if (!isInitialized) {
    try {
      await connectDb();
      await seedData();
    } catch (err) {
      console.warn('[Vercel Serverless] DB/Seed initialization warning:', err.message);
    }
    isInitialized = true;
  }
  return app(req, res);
};
