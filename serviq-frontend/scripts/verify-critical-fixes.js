/**
 * Comprehensive Automated Verification Script for:
 * 1. ISSUE 1 — Worker Counter-Offers Reaching Customer & Full Lifecycle
 * 2. ISSUE 2 — Worker Identity Isolation & Session Clean-up
 * 3. ISSUE 3 — Google Maps Tracking Configuration & Map Component
 */

import { dbService, calculateDistanceKm } from '../src/api/database.js';

// Setup Mock LocalStorage for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

async function runVerification() {
  console.log('=====================================================');
  console.log('🚀 STARTING SERVIQ CRITICAL FIXES VERIFICATION');
  console.log('=====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // -----------------------------------------------------------------
  // TEST 1: ISSUE 2 - WORKER IDENTITY ISOLATION & SESSION STORAGE
  // -----------------------------------------------------------------
  console.log('--- TEST SET 1: WORKER IDENTITY ISOLATION ---');

  const wafa = {
    id: 'worker-wafa-101',
    fullName: 'Wafa Technician',
    email: 'wafa@serviq.test',
    phoneNumber: '+919820111111',
    role: 'worker',
    primarySkill: 'AC repair',
    hourlyRate: 400,
    serviceArea: 'Bhayandar West, Mumbai',
    city: 'Bhayandar West, Mumbai',
    isOnline: true,
  };

  const baddie = {
    id: 'worker-baddie-202',
    fullName: 'Baddie AC Pro',
    email: 'baddie@serviq.test',
    phoneNumber: '+919820222222',
    role: 'worker',
    primarySkill: 'AC repair',
    hourlyRate: 350,
    serviceArea: 'Bhayandar West, Mumbai',
    city: 'Bhayandar West, Mumbai',
    isOnline: true,
  };

  // Sync workers to storage
  dbService.syncUser(wafa);
  dbService.syncUser(baddie);

  const profileWafa = dbService.getWorkerProfile(wafa.id);
  const profileBaddie = dbService.getWorkerProfile(baddie.id);

  assert(profileWafa && profileWafa.name === 'Wafa Technician', 'Wafa profile resolved with own name');
  assert(profileBaddie && profileBaddie.name === 'Baddie AC Pro', 'Baddie profile resolved with own name');
  assert(profileWafa.id !== profileBaddie.id, 'Profiles have distinct, strictly isolated IDs');

  // Verify dashboard stats isolation
  const wafaStats = await dbService.getWorkerDashboardStats(wafa.id);
  const baddieStats = await dbService.getWorkerDashboardStats(baddie.id);

  assert(wafaStats.todayEarnings === 0 && wafaStats.completedJobsWeek === 0, 'Wafa dashboard stats starts with 0/clean state');
  assert(baddieStats.todayEarnings === 0 && baddieStats.completedJobsWeek === 0, 'Baddie dashboard stats starts with 0/clean state');

  // -----------------------------------------------------------------
  // TEST 2: ISSUE 1 - COMPLETE COUNTER-OFFER LIFECYCLE
  // -----------------------------------------------------------------
  console.log('\n--- TEST SET 2: COUNTER-OFFER LIFECYCLE ---');

  const customerId = 'cust-priya-01';
  const customerName = 'Priya Sharma';

  // Step 1: Customer creates direct booking for Baddie at ₹350
  const booking = await dbService.createDirectBooking({
    customerId,
    customerName,
    workerId: baddie.id,
    service: 'AC repair',
    issue: 'Not cooling',
    budget: 350,
    address: 'Flat 402, Sea Green Apts, Bhayandar West',
    details: 'Master bedroom AC making humming noise',
    date: 'Today',
    time: 'Morning · 9 AM – 12 PM',
  });

  assert(booking && booking.id, `Service request created with ID ${booking.id}`);
  assert(booking.budget === 350 && booking.targetWorkerId === baddie.id, 'Booking persisted with ₹350 budget for Baddie');

  // Step 2: Baddie receives request in matching jobs
  const baddieJobs = await dbService.getMatchingJobs(baddie.id);
  const receivedJob = baddieJobs.find((j) => j.id === booking.id);
  assert(receivedJob != null, 'Baddie receives the incoming service request in their matching jobs');

  // Step 3: Wafa must NOT see direct booking intended for Baddie
  const wafaJobs = await dbService.getMatchingJobs(wafa.id);
  const wafaSawBaddieJob = wafaJobs.some((j) => j.id === booking.id);
  assert(!wafaSawBaddieJob, 'Wafa CANNOT see direct booking sent to Baddie (strict account scoping)');

  // Step 4: Baddie submits a counter-offer of ₹400
  const counterOffer = await dbService.counterJob(baddie.id, booking.id, 400);
  assert(counterOffer && counterOffer.price === 400, 'Counter-offer of ₹400 successfully saved');
  assert(counterOffer.status === 'pending', 'Counter-offer status is pending');

  // Step 5: Duplicate counter-offer submission prevention
  const duplicateCounter = await dbService.counterJob(baddie.id, booking.id, 420);
  assert(duplicateCounter.id === counterOffer.id, 'Duplicate counter-offer updates existing pending offer instead of creating duplicate');

  // Re-verify at ₹400
  await dbService.counterJob(baddie.id, booking.id, 400);

  // Step 6: Customer fetches bookings and reliably receives the ₹400 counter-offer
  const custBookings = await dbService.getCustomerBookings(customerId);
  const custBooking = custBookings.find((b) => b.id === booking.id);

  assert(custBooking != null, 'Customer bookings list contains the booking');
  assert(custBooking.price === 400, `Customer UI displays updated counter-offer price ₹400 (was ₹${booking.budget})`);
  assert(custBooking.status.includes('400'), `Customer UI displays status containing "400": "${custBooking.status}"`);
  assert(custBooking.counterOffer != null, 'Customer booking payload includes counterOffer object');
  assert(custBooking.counterOffer.price === 400, 'Customer counterOffer object contains price: 400');
  assert(custBooking.counterOffer.workerId === baddie.id, 'Customer counterOffer object associates Baddie as the worker');

  // Step 7: Worker sees that counter-offer has been submitted and is pending
  const baddieJobsAfterCounter = await dbService.getMatchingJobs(baddie.id);
  const baddieJobStatus = baddieJobsAfterCounter.find((j) => j.id === booking.id);
  assert(baddieJobStatus.hasPendingOffer === true, 'Worker sees hasPendingOffer is true');
  assert(baddieJobStatus.status.includes('400'), `Worker sees counter-offer sent status: "${baddieJobStatus.status}"`);

  // Step 8: Customer accepts the counter-offer
  const acceptResult = await dbService.customerAcceptOffer(customerId, booking.id, custBooking.counterOffer.id);
  assert(acceptResult.job.status === 'accepted', 'Job status transitions cleanly to "accepted"');
  assert(acceptResult.job.agreedPrice === 400, 'Job agreedPrice is locked at ₹400');
  assert(acceptResult.job.acceptedWorkerId === baddie.id, 'Job is officially assigned to Baddie');
  assert(acceptResult.offer.status === 'accepted', 'Counter-offer status transitions to "accepted"');

  // Step 9: Re-query customer bookings post-acceptance
  const custBookingsPostAccept = await dbService.getCustomerBookings(customerId);
  const acceptedBooking = custBookingsPostAccept.find((b) => b.id === booking.id);
  assert(acceptedBooking.status === 'Accepted', `Customer booking status is now "Accepted" (was: "${acceptedBooking.status}")`);
  assert(acceptedBooking.price === 400, 'Final price reflects agreed ₹400');
  assert(acceptedBooking.canTrack === true, 'Live worker tracking is now active for customer');

  // -----------------------------------------------------------------
  // TEST 3: ISSUE 1 - DECLINE COUNTER-OFFER FLOW
  // -----------------------------------------------------------------
  console.log('\n--- TEST SET 3: DECLINE COUNTER-OFFER FLOW ---');

  // Customer creates another request
  const booking2 = await dbService.createDirectBooking({
    customerId,
    customerName,
    workerId: baddie.id,
    service: 'AC repair',
    issue: 'Gas refill',
    budget: 350,
    address: 'Bhayandar West',
  });

  const offer2 = await dbService.counterJob(baddie.id, booking2.id, 500);
  assert(offer2.price === 500, 'Worker submitted ₹500 counter offer');

  // Customer declines the offer
  const declineResult = await dbService.customerDeclineOffer(customerId, booking2.id, offer2.id);
  assert(declineResult.offer.status === 'rejected', 'Counter offer marked as rejected');
  assert(declineResult.job.status === 'cancelled', 'Direct booking marked as cancelled upon decline');

  // -----------------------------------------------------------------
  // TEST 4: ISSUE 3 - GOOGLE MAPS & LIVE TRACKING DATA
  // -----------------------------------------------------------------
  console.log('\n--- TEST SET 4: LIVE TRACKING DATA INTEGRITY ---');

  // Update worker live location
  await dbService.updateWorkerLocation(baddie.id, { latitude: 19.295, longitude: 72.852 });

  const tracking = await dbService.getJobTracking(booking.id, customerId);
  assert(tracking != null, 'Tracking data resolved for active booking');
  assert(tracking.worker.name === 'Baddie AC Pro', 'Tracking worker name is Baddie');
  assert(tracking.worker.latitude === 19.295 && tracking.worker.longitude === 72.852, 'Tracking uses Baddie latest GPS coordinates');
  assert(tracking.destination.address.includes('Sea Green Apts'), 'Destination uses customer service address');

  console.log('\n=====================================================');
  console.log(`🎉 ALL ${passed}/${total} VERIFICATION ASSERTIONS PASSED!`);
  console.log('=====================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
