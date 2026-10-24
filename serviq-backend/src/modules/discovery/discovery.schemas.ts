import { z } from 'zod';

export const workerSearchQuerySchema = z.object({
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180),
  radiusKm: z.coerce.number().min(0.5).max(30, 'Search radius cannot exceed 30 km').default(10),
  category: z.string().min(1).optional(), // Slug or UUID
  availableNow: z.preprocess((val) => {
    if (typeof val === 'string') {
      return val.toLowerCase() === 'true' || val === '1';
    }
    return Boolean(val);
  }, z.boolean()).default(false),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['distance', 'rating', 'price_asc', 'experience']).default('distance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type WorkerSearchQueryInput = z.infer<typeof workerSearchQuerySchema>;
