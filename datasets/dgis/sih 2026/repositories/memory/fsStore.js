// repositories/memory/fsStore.js
// Lightweight /tmp disk persistence for Serverless environments (Vercel, Lambda)
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_DIR = path.join(os.tmpdir(), 'bivae_data');

function ensureDir() {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  } catch {}
}

function saveFile(filename, data) {
  try {
    ensureDir();
    const filePath = path.join(TMP_DIR, `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  } catch (err) {
    // Non-fatal if filesystem is readonly
  }
}

function loadFile(filename, defaultValue = null) {
  try {
    const filePath = path.join(TMP_DIR, `${filename}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {}
  return defaultValue;
}

module.exports = { saveFile, loadFile };
