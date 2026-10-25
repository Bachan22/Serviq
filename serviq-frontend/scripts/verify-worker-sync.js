import { dbService, INITIAL_DEMO_WORKERS } from '../src/api/database.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runTest() {
  console.log('--- TEST 1: INITIAL_DEMO_WORKERS contains Baddie, Fahim, and Imran ---');
  const baddieInit = INITIAL_DEMO_WORKERS.find((w) => w.id === '5be7b904-138b-42cc-855b-a8cf1634d97f');
  const fahimInit = INITIAL_DEMO_WORKERS.find((w) => w.id === 'demo-w-11');
  const imranInit = INITIAL_DEMO_WORKERS.find((w) => w.id === 'demo-w-5');

  assert(baddieInit != null, 'Baddie is present in INITIAL_DEMO_WORKERS');
  assert(baddieInit.name === 'Baddie', 'Baddie name is Baddie');
  assert(baddieInit.price === 350, 'Baddie price is ₹350');
  assert(baddieInit.skill === 'AC repair', 'Baddie skill is AC repair');

  assert(fahimInit != null, 'Fahim Ansari is present in INITIAL_DEMO_WORKERS');
  assert(fahimInit.name === 'Fahim Ansari', 'Fahim name is Fahim Ansari');
  assert(fahimInit.price === 460, 'Fahim price is ₹460');
  assert(fahimInit.skill === 'AC repair', 'Fahim skill is AC repair');

  assert(imranInit != null, 'Imran Shaikh is present in INITIAL_DEMO_WORKERS');
  assert(imranInit.name === 'Imran Shaikh', 'Imran name is Imran Shaikh');
  assert(imranInit.price === 450, 'Imran price is ₹450');
  assert(imranInit.skill === 'AC repair', 'Imran skill is AC repair');

  console.log('\n--- TEST 2: Category counts for AC repair matches eligible workers count ---');
  const counts = await dbService.getCategoryCounts(19.298, 72.855, 5);
  console.log('Category Counts:', counts);
  assert(counts['AC repair'] === 3, `AC repair category count is 3 (actual: ${counts['AC repair']})`);

  console.log('\n--- TEST 3: getNearbyWorkersLocally filters for AC repair within 5km ---');
  const localWorkers = dbService.getNearbyWorkersLocally({
    lat: 19.298,
    lng: 72.855,
    radiusKm: 5,
    serviceSlug: 'AC repair',
  });
  console.log('Local AC repair workers:', localWorkers.map(w => ({ id: w.id, name: w.name, price: w.price, distanceKm: w.distanceKm })));
  assert(localWorkers.length === 3, `Local AC repair workers count is 3 (actual: ${localWorkers.length})`);
  assert(localWorkers[0].name === 'Baddie', 'First closest worker is Baddie');
  assert(localWorkers[0].price === 350, 'Baddie price is ₹350');
  assert(localWorkers[0].distanceKm >= 0.8 && localWorkers[0].distanceKm <= 1.0, `Baddie distance ~0.9km (actual: ${localWorkers[0].distanceKm})`);

  assert(localWorkers[1].name === 'Fahim Ansari', 'Second closest worker is Fahim Ansari');
  assert(localWorkers[1].price === 460, 'Fahim price is ₹460');
  assert(localWorkers[1].distanceKm >= 1.1 && localWorkers[1].distanceKm <= 1.3, `Fahim distance ~1.2km (actual: ${localWorkers[1].distanceKm})`);

  assert(localWorkers[2].name === 'Imran Shaikh', 'Third closest worker is Imran Shaikh');
  assert(localWorkers[2].price === 450, 'Imran price is ₹450');
  assert(localWorkers[2].distanceKm >= 4.7 && localWorkers[2].distanceKm <= 4.9, `Imran distance ~4.8km (actual: ${localWorkers[2].distanceKm})`);

  console.log('\n--- TEST 4: Other service categories continue working ---');
  const plumbing = dbService.getNearbyWorkersLocally({
    lat: 19.298,
    lng: 72.855,
    radiusKm: 5,
    serviceSlug: 'Plumbing',
  });
  assert(plumbing.length > 0, `Plumbing workers found (count: ${plumbing.length})`);
  assert(counts['Plumbing'] === plumbing.length, `Plumbing category count matches filtered results (${counts['Plumbing']} === ${plumbing.length})`);

  console.log('\n🎉 ALL SYNCHRONIZATION TESTS PASSED SUCCESSFULLY!');
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
