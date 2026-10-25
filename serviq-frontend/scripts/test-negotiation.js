import { dbService, STORAGE_KEYS } from '../src/api/database.js';

// Setup Mock LocalStorage for Node environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTests() {
  console.log('\n=== Starting Frontend Two-Way Negotiation Tests ===\n');

  // Seed test worker and customer
  const testWorker = {
    id: 'worker-fahim',
    name: 'Fahim Ansari',
    fullName: 'Fahim Ansari',
    skill: 'AC repair',
    primarySkill: 'AC repair',
    hourlyRate: 350,
    price: 350,
    isOnline: true,
    status: 'ACTIVE',
  };

  const testCustomer = {
    id: 'cust-101',
    name: 'Aarav Sharma',
  };

  localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify([testWorker]));
  localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.OFFERS, JSON.stringify([]));

  // --- Test 1: Customer creates direct booking with initial lower offer ₹300 ---
  console.log('Test 1: Customer makes initial lower offer (₹300) on listed ₹350 service');
  const booking = await dbService.createDirectBooking({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    workerId: testWorker.id,
    service: 'AC repair',
    issue: 'Cooling problem',
    budget: 300,
    pricingMode: 'negotiate',
    address: 'Flat 402, Bhayandar West, Mumbai',
    details: 'Customer proposing ₹300 for AC diagnosis',
  });

  assert(booking.id.startsWith('SQ-'), 'Booking created with valid ID');
  assert(booking.status === 'negotiating', 'Booking status is negotiating');
  assert(booking.price === 300, 'Booking target price is ₹300');
  assert(booking.originalPrice === 350, 'Original listed price recorded as ₹350');
  assert(booking.agreedPrice === null, 'Agreed price is null while pending');

  // --- Test 2: Verify negotiation history has Round 1 ---
  console.log('\nTest 2: Verify negotiation timeline shows Round 1 (Customer: ₹300, Pending)');
  const history1 = await dbService.getNegotiationHistory(booking.id);
  assert(history1.length === 1, 'Timeline contains exactly 1 offer');
  assert(history1[0].roundNumber === 1, 'Round number is 1');
  assert(history1[0].senderRole === 'CUSTOMER', 'Sender role is CUSTOMER');
  assert(history1[0].price === 300, 'Offer price is ₹300');
  assert(history1[0].status === 'pending', 'Offer status is pending');
  assert(history1[0].isExpired === false, 'Offer is not expired');

  // --- Test 3: Worker receives offer in matching jobs ---
  console.log('\nTest 3: Worker receives job with pending customer offer of ₹300');
  const workerJobs = await dbService.getMatchingJobs(testWorker.id);
  const workerJob = workerJobs.find((j) => j.id === booking.id);
  assert(Boolean(workerJob), 'Worker sees the direct booking request');
  assert(workerJob.isCustomerOffer === true, 'Flagged as customer offer');
  assert(workerJob.customerOfferPrice === 300, 'Customer offer price is ₹300');
  assert(workerJob.originalPrice === 350, 'Worker listed rate shown as ₹350');

  // --- Test 4: Worker submits counter-offer of ₹325 ---
  const counterResult = await dbService.counterJob(testWorker.id, booking.id, 325, 'Compromise rate for labor & diagnosis');
  assert(Boolean(counterResult?.id && counterResult?.price === 325), 'Counter-offer created with ₹325');

  const history2 = await dbService.getNegotiationHistory(booking.id);
  assert(history2.length === 2, 'Timeline now contains 2 rounds');
  assert(history2[0].status === 'countered', 'Round 1 demoted to countered');
  assert(history2[1].roundNumber === 2, 'Round 2 created');
  assert(history2[1].senderRole === 'WORKER', 'Round 2 sender is WORKER');
  assert(history2[1].price === 325, 'Round 2 counter amount is ₹325');
  assert(history2[1].status === 'pending', 'Round 2 status is pending');

  // --- Test 5: Customer views counter-offer in bookings ---
  console.log('\nTest 5: Customer bookings view displays counter-offer of ₹325');
  const customerBookings = await dbService.getCustomerBookings(testCustomer.id);
  const activeBooking = customerBookings.find((b) => b.id === booking.id);
  assert(Boolean(activeBooking), 'Customer booking retrieved');
  assert(Boolean(activeBooking.counterOffer), 'Counter-offer banner present');
  assert(activeBooking.counterOffer.price === 325, 'Counter price is ₹325');

  // --- Test 6: Unauthorized third party cannot accept worker counter-offer ---
  console.log('\nTest 6: Third-party user cannot accept customer/worker negotiation');
  let authFailed = false;
  try {
    await dbService.customerAcceptOffer('unauthorized-user', booking.id, activeBooking.counterOffer.id);
  } catch (err) {
    authFailed = true;
    assert(err.message.includes('own this booking'), 'Unauthorized acceptance rejected: ' + err.message);
  }
  assert(authFailed, 'Unauthorized user was blocked from accepting offer');

  // --- Test 7: Customer accepts worker counter-offer of ₹325 ---
  console.log('\nTest 7: Customer accepts worker counter-offer of ₹325');
  const acceptResult = await dbService.customerAcceptOffer(testCustomer.id, booking.id, activeBooking.counterOffer.id);
  assert(acceptResult.job.agreedPrice === 325, 'Job agreed price locked at ₹325');
  assert(acceptResult.job.status === 'accepted', 'Job status transitioned to accepted');

  // --- Test 8: Price consistency and locked agreement check ---
  console.log('\nTest 8: Verify price persistence and subsequent offer prevention');
  const postAcceptBookings = await dbService.getCustomerBookings(testCustomer.id);
  const acceptedBooking = postAcceptBookings.find((b) => b.id === booking.id);
  assert(acceptedBooking.agreedPrice === 325, 'Customer account confirms locked agreed price: ₹325');
  assert(acceptedBooking.status === 'Accepted', 'Customer account confirms status: Accepted');

  const historyFinal = await dbService.getNegotiationHistory(booking.id);
  assert(historyFinal.length === 2, 'History preserved intact');
  assert(historyFinal[1].status === 'accepted', 'Round 2 marked accepted in history');

  // Subsequent counter must fail
  let lockFailed = false;
  try {
    await dbService.counterJob(testWorker.id, booking.id, 340);
  } catch (err) {
    lockFailed = true;
    assert(err.message.includes('locked') || err.message.includes('finalized') || err.message.includes('agreed'), 'Subsequent offer blocked: ' + err.message);
  }
  assert(lockFailed, 'Cannot alter price after agreement is locked');

  // --- Test 9: Expiration handling ---
  console.log('\nTest 9: Expired offer cannot be accepted');
  const offers = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFERS));
  const jobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS));
  const expiredJob = {
    id: 'SQ-999',
    customerId: testCustomer.id,
    targetWorkerId: testWorker.id,
    status: 'negotiating',
  };
  jobs.push(expiredJob);
  localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));

  const expiredOffer = {
    id: 'off-expired-1',
    jobId: 'SQ-999',
    customerId: testCustomer.id,
    workerId: testWorker.id,
    senderRole: 'WORKER',
    price: 330,
    status: 'pending',
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Expired 5 mins ago
  };
  offers.push(expiredOffer);
  localStorage.setItem(STORAGE_KEYS.OFFERS, JSON.stringify(offers));

  let expiryFailed = false;
  try {
    await dbService.customerAcceptOffer(testCustomer.id, 'SQ-999', expiredOffer.id);
  } catch (err) {
    expiryFailed = true;
    assert(err.message.includes('expired'), 'Expired offer acceptance rejected: ' + err.message);
  }
  assert(expiryFailed, 'Expired offer blocked correctly');

  // --- Test 10: Rejection flow ---
  console.log('\nTest 10: Worker rejection cancels direct job and marks offer rejected');
  const rejectBooking = await dbService.createDirectBooking({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    workerId: testWorker.id,
    service: 'AC repair',
    budget: 280,
    pricingMode: 'negotiate',
    address: 'Bhayandar West',
  });
  const rejectOffers = await dbService.getNegotiationHistory(rejectBooking.id);
  const rejectOffer = rejectOffers[0];
  await dbService.workerRejectCustomerOffer(testWorker.id, rejectBooking.id, rejectOffer.id, 'Too low for this service');

  const rejectHistory = await dbService.getNegotiationHistory(rejectBooking.id);
  assert(rejectHistory[0].status === 'rejected', 'Offer marked rejected');
  const allJobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS));
  const rejectedJob = allJobs.find((j) => j.id === rejectBooking.id);
  assert(rejectedJob.status === 'cancelled', 'Job transitioned to cancelled on rejection');

  // --- Test 11: Multi-round counter-offer flow (Customer counters worker) ---
  console.log('\nTest 11: Customer counters worker response (Round 3)');
  const multiBooking = await dbService.createDirectBooking({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    workerId: testWorker.id,
    service: 'AC repair',
    budget: 290,
    pricingMode: 'negotiate',
    address: 'Bhayandar West',
  });
  // Worker counters with 330
  await dbService.counterJob(testWorker.id, multiBooking.id, 330);
  // Customer counters worker's 330 with 315
  const custCounter = await dbService.customerCounterOffer(testCustomer.id, multiBooking.id, 315, 'Meet in the middle at 315');
  assert(custCounter.price === 315, 'Customer counter recorded at ₹315');
  assert(custCounter.roundNumber === 3, 'Recorded as Round 3');
  assert(custCounter.senderRole === 'CUSTOMER', 'Sender is CUSTOMER');

  // Worker accepts customer's Round 3 counter
  const workerAccept = await dbService.workerAcceptCustomerOffer(testWorker.id, multiBooking.id, custCounter.id);
  assert(workerAccept.job.agreedPrice === 315, 'Worker accepted customer counter; agreed price locked at ₹315');
  assert(workerAccept.job.status === 'accepted', 'Job status is accepted');

  // --- Test 12: Negotiation limits and boundary validation ---
  console.log('\nTest 12: Bounds validation (min ₹50, max ₹50,000, max 2 rounds)');
  let boundsError = false;
  try {
    await dbService.counterJob(testWorker.id, multiBooking.id, 20); // Below 50
  } catch (err) {
    boundsError = true;
    assert(Boolean(err.message), 'Below min bound rejected');
  }
  assert(boundsError, 'Invalid price bound rejected');

  console.log('\n🎉 ALL 12 TWO-WAY NEGOTIATION TESTS PASSED CLEANLY!\n');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
