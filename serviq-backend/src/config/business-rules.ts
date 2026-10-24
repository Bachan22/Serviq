import { env } from './env.js';

export const BusinessRules = {
  commission: {
    serviceLaborRatePct: env.COMMISSION_LABOR_RATE_PCT,
    materialsFeeRatePct: 0, // Always 0% on materials/hardware parts
    minPlatformFeeAmount: 15, // In ₹
  },
  wallet: {
    maxNegativeBalance: env.WALLET_MAX_NEGATIVE_LIMIT, // e.g. -1500
    autoDebitOnCashBooking: true,
  },
  cancellation: {
    gracePeriodMinutes: env.CANCEL_GRACE_PERIOD_MINS,
    tripFeeAmount: env.CANCEL_TRIP_FEE_AMOUNT,
    workerSharePct: env.CANCEL_WORKER_SHARE_PCT,
    platformSharePct: env.CANCEL_PLATFORM_SHARE_PCT,
    workerDelayThresholdMinutes: 15,
  },
  negotiation: {
    maxRoundsPerParty: env.MAX_NEGOTIATION_ROUNDS,
    offerExpiryMinutes: env.OFFER_EXPIRY_MINS,
  },
  discovery: {
    defaultSearchRadiusKm: env.DEFAULT_SEARCH_RADIUS_KM,
    maxSearchRadiusKm: 30,
  },
} as const;
