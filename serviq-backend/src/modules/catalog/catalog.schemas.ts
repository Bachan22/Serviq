import { z } from 'zod';

export const listCategoriesQuerySchema = z.object({
  includeInactive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  parentId: z.string().uuid().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric with dashes'),
  description: z.string().max(500).optional(),
  iconKey: z.string().min(1).max(50),
  parentId: z.string().uuid().optional(),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  typicalPriceMin: z.coerce.number().min(0).optional(),
  typicalPriceMax: z.coerce.number().min(0).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
