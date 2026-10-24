import { eq } from 'drizzle-orm';
import { db } from '../../database/connection';
import { customerProfiles } from '../../database/schema/customer-profiles';
import { users } from '../../database/schema/users';
import { addresses } from '../../database/schema/addresses';
import { NotFoundError, UnauthorizedError } from '../../common/errors/app-error';

export class CustomerService {
  async getProfile(userId: string) {
    let profile = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.id, userId),
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new UnauthorizedError('User account not found.');
    }

    // Auto-initialize profile if accessing for the first time
    if (!profile) {
      const defaultName = `Customer ${user.phoneNumber.slice(-4)}`;
      const [newProfile] = await db.insert(customerProfiles).values({
        id: userId,
        displayName: defaultName,
      }).returning();
      profile = newProfile;
    }

    // Fetch default address if available
    const defaultAddress = await db.query.addresses.findFirst({
      where: eq(addresses.customerId, userId),
    });

    return {
      id: profile.id,
      displayName: profile.displayName,
      phoneNumber: user.phoneNumber,
      email: user.email,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      emergencyPhone: profile.emergencyPhone,
      defaultAddress: defaultAddress ? {
        id: defaultAddress.id,
        addressLabel: defaultAddress.addressLabel,
        locality: defaultAddress.locality,
        city: defaultAddress.city,
      } : null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async updateProfile(userId: string, data: { displayName: string; bio?: string; avatarUrl?: string; emergencyPhone?: string }) {
    // Upsert customer profile
    const existing = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.id, userId),
    });

    let updated;
    if (existing) {
      const [res] = await db.update(customerProfiles).set({
        displayName: data.displayName,
        bio: data.bio ?? existing.bio,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        emergencyPhone: data.emergencyPhone ?? existing.emergencyPhone,
        updatedAt: new Date(),
      }).where(eq(customerProfiles.id, userId)).returning();
      updated = res;
    } else {
      const [res] = await db.insert(customerProfiles).values({
        id: userId,
        displayName: data.displayName,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        emergencyPhone: data.emergencyPhone,
      }).returning();
      updated = res;
    }

    return updated;
  }
}

export const customerService = new CustomerService();
