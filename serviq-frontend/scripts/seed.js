/**
 * CLI script for npm run seed and npm run seed:clean
 */
import { dbService } from '../src/api/database.js';

// Mock localStorage for CLI node execution
const storage = new Map();
global.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

const isClean = process.argv.includes('--clean');

if (isClean) {
  console.log('Running Serviq Seed Clean...');
  dbService.cleanDemoData();
  console.log('Clean complete: All demo data flagged with is_demo: true removed.');
} else {
  console.log('Running Serviq Demo Seed...');
  dbService.seedDemoData(true);
  console.log('Seed complete: Demo workers and demo reviews seeded.');
}
