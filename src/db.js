const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.json');
const SCHEMES_PATH = path.join(__dirname, '..', 'data', 'schemes.json');
const DIRECTORY_PATH = path.join(__dirname, '..', 'data', 'directory.json');
const RADAR_PATH = path.join(__dirname, '..', 'data', 'radar.json');

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return {};
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

module.exports = {
  getStore: () => readJson(STORE_PATH),
  saveStore: (data) => writeJson(STORE_PATH, data),
  getCatalog: () => readJson(CATALOG_PATH),
  getSchemes: () => readJson(SCHEMES_PATH),
  getDirectory: () => readJson(DIRECTORY_PATH),
  getRadar: () => readJson(RADAR_PATH),
  saveRadar: (data) => writeJson(RADAR_PATH, data)
};
