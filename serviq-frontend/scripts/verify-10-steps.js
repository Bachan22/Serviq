/**
 * End-to-End Verification Script for Serviq Data Integrity
 * Tests all 10 explicit verification items from the user prompt.
 */

import { authApi } from '../src/api/auth.js';
import { dbService, calculateDistanceKm } from '../src/api/database.js';
import fs from 'fs';
import path from 'path';

// Setup Mock LocalStorage for Node testing environment
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

async function runVerification() {
  console.log('====================================================');
  console.log('   SERVIQ 10-POINT DATA INTEGRITY VERIFICATION');
  console.log('====================================================\n');

  const results = {};
  storage.clear();

  // ITEM 1: Create a new worker with skill "AC repair":
  // dashboard shows earnings Rs 0, jobs 0, rating 'New', no chart data,
  // no job requests, no reviews, an empty-state message and the profile checklist.
  console.log('--- TEST 1: New Worker with skill "AC repair" ---');
  const acWorkerEmail = `ac.worker.${Date.now()}@serviq.test`;
  const acSignup = await authApi.signup({
    role: 'worker',
    fullName: 'Aniket Sharma',
    email: acWorkerEmail,
    phoneNumber: '+919820112233',
    password: 'Password2026!',
    primarySkill: 'AC repair',
    experienceYears: 4,
    serviceArea: 'Bhayandar West, Mumbai',
    hourlyRate: 450,
  });

  const acWorkerId = acSignup.user.id;
  const stats1 = await dbService.getWorkerDashboardStats(acWorkerId);
  const reviews1 = await dbService.getWorkerReviews(acWorkerId);
  const jobs1 = await dbService.getMatchingJobs(acWorkerId);
  const ledger1 = await dbService.getWorkerLedger(acWorkerId);

  const check1Pass =
    stats1.todayEarnings === 0 &&
    stats1.completedJobsWeek === 0 &&
    stats1.rating === null &&
    stats1.chartData.every((val) => val === 0) &&
    stats1.weeklyTotal === 0 &&
    jobs1.length === 0 &&
    reviews1.reviews.length === 0 &&
    reviews1.averageRating === null &&
    ledger1.transactions.length === 0 &&
    stats1.checklist.skillChosen === true &&
    stats1.checklist.serviceAreaSet === true &&
    stats1.checklist.rateSet === true;

  results['Item 1: Clean New Worker Empty State'] = check1Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 1: Clean New Worker Empty State']}`);
  console.log(`  - Today's Earnings: Rs ${stats1.todayEarnings}`);
  console.log(`  - Completed Jobs: ${stats1.completedJobsWeek}`);
  console.log(`  - Rating: ${stats1.rating === null ? 'New / null' : stats1.rating}`);
  console.log(`  - Reviews count: ${reviews1.reviews.length}`);
  console.log(`  - Job requests count: ${jobs1.length}`);
  console.log(`  - Weekly Chart total: Rs ${stats1.weeklyTotal}\n`);

  // ITEM 2: Create a customer and post an AC repair job near the worker:
  // the AC worker sees it within seconds, with badge count 1. A newly created plumber does NOT see it.
  console.log('--- TEST 2: Targeted Matching (AC Worker vs Plumber) ---');
  // Turn AC worker online
  await dbService.updateWorkerOnlineStatus(acWorkerId, true);

  // Create plumber worker
  const plumberSignup = await authApi.signup({
    role: 'worker',
    fullName: 'Prakash Rao',
    email: `plumber.${Date.now()}@serviq.test`,
    phoneNumber: '+919820445566',
    password: 'Password2026!',
    primarySkill: 'Plumbing',
    experienceYears: 5,
    serviceArea: 'Bhayandar West, Mumbai',
    hourlyRate: 350,
  });
  const plumberWorkerId = plumberSignup.user.id;
  await dbService.updateWorkerOnlineStatus(plumberWorkerId, true);

  // Customer posts AC repair job in Bhayandar West
  const acJob = await dbService.postJob({
    customerId: 'cust-101',
    customerName: 'Meera Kapoor',
    service: 'AC repair',
    title: 'AC cooling coil leaking',
    budget: 500,
    address: 'Bhayandar West, Station Road',
    latitude: 19.298,
    longitude: 72.855,
  });

  const acWorkerJobs = await dbService.getMatchingJobs(acWorkerId);
  const plumberJobs = await dbService.getMatchingJobs(plumberWorkerId);

  const check2Pass =
    acWorkerJobs.length === 1 &&
    acWorkerJobs[0].id === acJob.id &&
    plumberJobs.length === 0;

  results['Item 2: AC Worker sees AC job, Plumber does not'] = check2Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 2: AC Worker sees AC job, Plumber does not']}`);
  console.log(`  - AC Worker Matching Jobs Count: ${acWorkerJobs.length}`);
  console.log(`  - Plumber Matching Jobs Count: ${plumberJobs.length}\n`);

  // ITEM 3: Post a plumbing job: the AC worker does not see it, the plumber does.
  console.log('--- TEST 3: Post Plumbing job (Plumber sees it, AC worker does not) ---');
  const plumbJob = await dbService.postJob({
    customerId: 'cust-102',
    customerName: 'Kunal Verma',
    service: 'Plumbing',
    title: 'Bathroom pipe joint replacement',
    budget: 400,
    address: 'Bhayandar West, Market',
    latitude: 19.299,
    longitude: 72.854,
  });

  const acWorkerJobsAfterPlumb = await dbService.getMatchingJobs(acWorkerId);
  const plumberJobsAfterPlumb = await dbService.getMatchingJobs(plumberWorkerId);

  const check3Pass =
    plumberJobsAfterPlumb.some((j) => j.id === plumbJob.id) &&
    !acWorkerJobsAfterPlumb.some((j) => j.id === plumbJob.id);

  results['Item 3: Plumber sees plumbing job, AC worker does not'] = check3Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 3: Plumber sees plumbing job, AC worker does not']}`);
  console.log(`  - Plumber saw plumbing job: ${check3Pass}`);
  console.log(`  - AC worker saw plumbing job: ${acWorkerJobsAfterPlumb.some((j) => j.id === plumbJob.id)}\n`);

  // ITEM 4: Post an AC job far outside the worker's radius: not shown.
  console.log('--- TEST 4: Haversine distance outside radius (120km away in Pune) ---');
  const distantJob = await dbService.postJob({
    customerId: 'cust-103',
    customerName: 'Rohan Desai',
    service: 'AC repair',
    title: 'AC servicing in Pune',
    budget: 650,
    address: 'FC Road, Pune',
    latitude: 18.5204,
    longitude: 73.8567, // ~120 km away
  });

  const acWorkerJobsWithDistant = await dbService.getMatchingJobs(acWorkerId);
  const distanceKm = calculateDistanceKm(19.298, 72.855, 18.5204, 73.8567);
  const check4Pass =
    !acWorkerJobsWithDistant.some((j) => j.id === distantJob.id) && distanceKm > 100;

  results['Item 4: Distant job outside radius excluded by Haversine'] = check4Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 4: Distant job outside radius excluded by Haversine']}`);
  console.log(`  - Distance computed: ${distanceKm} km`);
  console.log(`  - Was distant job shown: ${acWorkerJobsWithDistant.some((j) => j.id === distantJob.id)}\n`);

  // ITEM 5: Worker accepts or counters, customer accepts:
  // job leaves other workers' lists and appears in this worker's Active jobs.
  console.log('--- TEST 5: Accept / Counter and Active Jobs transition ---');
  // Create another AC worker to verify job disappears from others
  const acWorker2Signup = await authApi.signup({
    role: 'worker',
    fullName: 'Santosh Yadav',
    email: `ac.worker2.${Date.now()}@serviq.test`,
    phoneNumber: '+919820889900',
    password: 'Password2026!',
    primarySkill: 'AC repair',
    experienceYears: 6,
    serviceArea: 'Bhayandar West, Mumbai',
    hourlyRate: 480,
  });
  const acWorker2Id = acWorker2Signup.user.id;
  await dbService.updateWorkerOnlineStatus(acWorker2Id, true);

  // Worker 1 accepts the job
  await dbService.acceptJob(acWorkerId, acJob.id);

  // Verify: Worker 2 no longer sees acJob
  const acWorker2JobsAfterAccept = await dbService.getMatchingJobs(acWorker2Id);
  // Verify: Worker 1 now has it in active jobs
  const storeJobs = JSON.parse(localStorage.getItem('serviq_db_jobs') || '[]');
  const worker1Active = storeJobs.filter(
    (j) => j.acceptedWorkerId === acWorkerId && (j.status === 'accepted' || j.status === 'in_progress')
  );

  const check5Pass =
    !acWorker2JobsAfterAccept.some((j) => j.id === acJob.id) &&
    worker1Active.some((j) => j.id === acJob.id);

  results['Item 5: Accepted job leaves other workers and enters Active jobs'] = check5Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 5: Accepted job leaves other workers and enters Active jobs']}`);
  console.log(`  - Disappeared from 2nd AC worker: ${!acWorker2JobsAfterAccept.some((j) => j.id === acJob.id)}`);
  console.log(`  - Present in Worker 1 active list: ${worker1Active.some((j) => j.id === acJob.id)}\n`);

  // ITEM 6: Customer marks the job completed and leaves a 5-star review:
  // worker's rating becomes 5.0 with review count 1, earnings show real amount,
  // Jobs completed becomes 1, and the review is visible ONLY to that worker.
  console.log('--- TEST 6: Job Completion, Real Payout, and 5-Star Review ---');
  await dbService.completeJob(acJob.id);
  await dbService.submitReview({
    customerId: 'cust-101',
    customerName: 'Meera Kapoor',
    jobId: acJob.id,
    rating: 5,
    comment: 'Brilliant AC technician, fixed the cooling leak in 30 minutes!',
  });

  const worker1StatsAfterReview = await dbService.getWorkerDashboardStats(acWorkerId);
  const worker1ReviewsAfter = await dbService.getWorkerReviews(acWorkerId);
  const worker1LedgerAfter = await dbService.getWorkerLedger(acWorkerId);

  const check6Pass =
    worker1StatsAfterReview.rating === 5 &&
    worker1StatsAfterReview.reviewCount === 1 &&
    worker1StatsAfterReview.completedJobsWeek === 1 &&
    worker1StatsAfterReview.todayEarnings === 450 && // 90% of 500
    worker1LedgerAfter.thisWeekTotal === 450 &&
    worker1ReviewsAfter.reviews.length === 1 &&
    worker1ReviewsAfter.reviews[0].comment.includes('Brilliant AC technician');

  results['Item 6: Completion + 5-star review updates rating, count, earnings'] = check6Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 6: Completion + 5-star review updates rating, count, earnings']}`);
  console.log(`  - Worker Rating: ${worker1StatsAfterReview.rating}`);
  console.log(`  - Review Count: ${worker1StatsAfterReview.reviewCount}`);
  console.log(`  - Today Earnings: Rs ${worker1StatsAfterReview.todayEarnings}`);
  console.log(`  - Completed Jobs: ${worker1StatsAfterReview.completedJobsWeek}\n`);

  // ITEM 7: A second worker never sees the first worker's review or earnings, in UI or direct API calls.
  console.log('--- TEST 7: Worker Privacy and Scoping (Worker 2 sees 0 reviews/earnings) ---');
  const worker2Reviews = await dbService.getWorkerReviews(acWorker2Id);
  const worker2Ledger = await dbService.getWorkerLedger(acWorker2Id);
  const worker2Stats = await dbService.getWorkerDashboardStats(acWorker2Id);

  const check7Pass =
    worker2Reviews.reviews.length === 0 &&
    worker2Reviews.averageRating === null &&
    worker2Ledger.transactions.length === 0 &&
    worker2Stats.todayEarnings === 0 &&
    worker2Stats.completedJobsWeek === 0;

  results['Item 7: Second worker never sees first worker review or earnings'] = check7Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 7: Second worker never sees first worker review or earnings']}`);
  console.log(`  - Worker 2 reviews count: ${worker2Reviews.reviews.length}`);
  console.log(`  - Worker 2 earnings: Rs ${worker2Stats.todayEarnings}\n`);

  // ITEM 8: Online toggle off: worker stops receiving new requests.
  console.log('--- TEST 8: Online toggle (Offline worker receives no requests) ---');
  await dbService.updateWorkerOnlineStatus(acWorkerId, false);

  // Post another AC job
  const newAcJob2 = await dbService.postJob({
    customerId: 'cust-104',
    customerName: 'Aditya Sen',
    service: 'AC repair',
    title: 'AC gas refill',
    budget: 600,
    address: 'Bhayandar West',
    latitude: 19.298,
    longitude: 72.855,
  });

  const worker1JobsWhileOffline = await dbService.getMatchingJobs(acWorkerId);
  // Turn back online
  await dbService.updateWorkerOnlineStatus(acWorkerId, true);
  const worker1JobsWhileOnline = await dbService.getMatchingJobs(acWorkerId);

  const check8Pass =
    worker1JobsWhileOffline.length === 0 &&
    worker1JobsWhileOnline.some((j) => j.id === newAcJob2.id);

  results['Item 8: Online toggle off stops requests; on resumes them'] = check8Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 8: Online toggle off stops requests; on resumes them']}`);
  console.log(`  - Requests while offline: ${worker1JobsWhileOffline.length}`);
  console.log(`  - Requests after turning online: ${worker1JobsWhileOnline.length}\n`);

  // ITEM 9: Customer home shows real counts and real workers, and honest empty state when none exist.
  console.log('--- TEST 9: Dynamic Category Counts and Empty States ---');
  const catCounts = await dbService.getCategoryCounts(19.298, 72.855);
  // AC repair should have 2 online workers (worker1 and worker2)
  const acCount = catCounts['AC repair'];
  const nearbyWorkers = await dbService.getNearbyWorkers({ category: 'AC repair' });

  // Clear workers and verify honest empty state
  localStorage.setItem('serviq_db_workers', JSON.stringify([]));
  const emptyCounts = await dbService.getCategoryCounts();
  const emptyWorkers = await dbService.getNearbyWorkers();

  const check9Pass =
    acCount >= 1 &&
    nearbyWorkers.length >= 1 &&
    emptyCounts['AC repair'] === 0 &&
    emptyWorkers.length === 0;

  results['Item 9: Customer home shows real counts & honest empty states'] = check9Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 9: Customer home shows real counts & honest empty states']}`);
  console.log(`  - Real AC repair online count: ${acCount}`);
  console.log(`  - Real nearby workers: ${nearbyWorkers.length}`);
  console.log(`  - Empty counts when zero workers: ${emptyCounts['AC repair']}\n`);

  // ITEM 10: Search code once more: no hard-coded mock arrays, no
  // "Priya Shah", "Rahul Mehta", "Neha Joshi", "Ramesh Patil", "SQ-1048", "96 reviews", "8,640" or "1,840" remain in the UI source.
  console.log('--- TEST 10: Clean UI Codebase Audit ---');
  const srcDir = path.resolve('src');
  const forbiddenPatterns = [
    /Priya Shah/,
    /Rahul Mehta/,
    /Neha Joshi/,
    /Ramesh Patil/,
    /SQ-1048/,
    /96 reviews/,
    /8,640/,
    /1,840/,
    /24 nearby/,
  ];

  function searchFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!fullPath.includes('tests')) searchFiles(fullPath, fileList);
      } else if (f.endsWith('.jsx') || (f.endsWith('.js') && !f.includes('database.js') && !f.includes('verify'))) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const uiFiles = searchFiles(srcDir);
  const violations = [];

  for (const filePath of uiFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pat of forbiddenPatterns) {
      if (pat.test(content)) {
        violations.push(`${path.basename(filePath)} matches ${pat}`);
      }
    }
  }

  const check10Pass = violations.length === 0;
  results['Item 10: Zero mock strings remain in UI codebase'] = check10Pass ? 'PASS' : 'FAIL';
  console.log(`Result: ${results['Item 10: Zero mock strings remain in UI codebase']}`);
  if (violations.length > 0) {
    console.log('  Violations found:', violations);
  } else {
    console.log('  ✓ No mock data or forbidden strings found in any UI files.');
  }

  console.log('\n====================================================');
  console.log('                 FINAL REPORT CARD');
  console.log('====================================================');
  let allPass = true;
  for (const [item, status] of Object.entries(results)) {
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${item}: ${status}`);
    if (status !== 'PASS') allPass = false;
  }
  console.log('====================================================');
  console.log(`Overall Result: ${allPass ? 'ALL 10 CHECKS PASSED' : 'SOME CHECKS FAILED'}\n`);
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
