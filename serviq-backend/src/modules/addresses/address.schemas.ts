import { z } from 'zod';

export const createAddressSchema = z.object({
  addressLabel: z.string().min(1, 'Address label is required (e.g. Home, Office)').max(50),
  recipientName: z.string().max(100).optional(),
  recipientPhone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format').optional().or(z.literal('')),
  addressLine1: z.string().min(3, 'Address line 1 is required').max(255),
  addressLine2: z.string().max(255).optional(),
  locality: z.string().min(2, 'Locality is required').max(100),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().max(100).default('Maharashtra'),
  postalCode: z.string().min(4, 'Postal code is required').max(20),
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
