import { eq, and } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { customerProfiles } from '../../database/schema/customer-profiles.js';
import { workerProfiles } from '../../database/schema/worker-profiles.js';
import { savedWorkers } from '../../database/schema/saved-workers.js';
import { users } from '../../database/schema/users.js';
import { addresses } from '../../database/schema/addresses.js';
import { NotFoundError, UnauthorizedError } from '../../common/errors/app-error.js';

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

    if (!profile) {
      const defaultName = `Customer ${user.phoneNumber.slice(-4)}`;
      const [newProfile] = await db
        .insert(customerProfiles)
        .values({
          id: userId,
          displayName: defaultName,
        })
        .returning();
      profile = newProfile;
    }

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
      defaultAddress: defaultAddress
        ? {
            id: defaultAddress.id,
            addressLabel: defaultAddress.addressLabel,
            locality: defaultAddress.locality,
            city: defaultAddress.city,
          }
        : null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async updateProfile(
    userId: string,
    data: { displayName?: string; bio?: string; avatarUrl?: string; emergencyPhone?: string; area?: string; latitude?: number; longitude?: number }
  ) {
    const existing = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.id, userId),
    });

    let updated;
    if (existing) {
      const [res] = await db
        .update(customerProfiles)
        .set({
          displayName: data.displayName ?? existing.displayName,
          bio: data.bio ?? existing.bio,
          avatarUrl: data.avatarUrl ?? existing.avatarUrl,
          emergencyPhone: data.emergencyPhone ?? existing.emergencyPhone,
          area: data.area ?? existing.area,
          latitude: data.latitude ?? existing.latitude,
          longitude: data.longitude ?? existing.longitude,
          updatedAt: new Date(),
        })
        .where(eq(customerProfiles.id, userId))
        .returning();
      updated = res;
    } else {
      const [res] = await db
        .insert(customerProfiles)
        .values({
          id: userId,
          displayName: data.displayName || 'Customer',
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          emergencyPhone: data.emergencyPhone,
          area: data.area,
          latitude: data.latitude,
          longitude: data.longitude,
        })
        .returning();
      updated = res;
    }

    return updated;
  }

  async getSavedWorkers(customerId: string) {
    const list = await db
      .select({
        workerId: workerProfiles.id,
        displayName: workerProfiles.displayName,
        skill: workerProfiles.skill,
        averageRating: workerProfiles.averageRating,
        totalReviewsCount: workerProfiles.totalReviewsCount,
        hourlyRate: workerProfiles.hourlyRate,
        serviceArea: workerProfiles.serviceArea,
        isVerified: workerProfiles.isVerified,
        isOnline: workerProfiles.isOnline,
        avatarUrl: workerProfiles.avatarUrl,
        savedAt: savedWorkers.createdAt,
      })
      .from(savedWorkers)
      .innerJoin(workerProfiles, eq(savedWorkers.workerId, workerProfiles.id))
      .where(eq(savedWorkers.customerId, customerId));

    return list.map((w) => ({
      id: w.workerId,
      name: w.displayName,
      fullName: w.displayName,
      skill: w.skill,
      primarySkill: w.skill,
      rating: w.averageRating ? Number(w.averageRating) : null,
      reviews: w.totalReviewsCount,
      price: Number(w.hourlyRate || 350),
      serviceArea: w.serviceArea || 'Local area',
      isVerified: w.isVerified,
      isOnline: w.isOnline,
      savedAt: w.savedAt,
    }));
  }

  async saveWorker(customerId: string, workerId: string) {
    const [saved] = await db
      .insert(savedWorkers)
      .values({
        customerId,
        workerId,
      })
      .onConflictDoNothing()
      .returning();
    return { success: true, saved };
  }

  async removeSavedWorker(customerId: string, workerId: string) {
    await db
      .delete(savedWorkers)
      .where(and(eq(savedWorkers.customerId, customerId), eq(savedWorkers.workerId, workerId)));
    return { success: true };
  }
}

export const customerService = new CustomerService();
