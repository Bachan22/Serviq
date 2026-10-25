import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { workerProfiles } from '../../database/schema/worker-profiles.js';
import { workerSkills } from '../../database/schema/worker-skills.js';
import { serviceCategories } from '../../database/schema/categories.js';
import { users } from '../../database/schema/users.js';
import { wallets } from '../../database/schema/wallets.js';
import { walletTransactions } from '../../database/schema/wallet-transactions.js';
import { bookings } from '../../database/schema/bookings.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/app-error.js';
import { UpdateWorkerProfileInput, AddWorkerSkillInput } from './worker.schemas.js';

export class WorkerService {
  private calculateCompleteness(profile: any, hasSkills: boolean, hasLocation: boolean): number {
    let score = 20; // Base registration
    if (profile.displayName && profile.displayName.length >= 2) score += 15;
    if (profile.bio && profile.bio.length >= 10) score += 15;
    if (profile.avatarUrl) score += 10;
    if (profile.baseVisitingFee && Number(profile.baseVisitingFee) > 0) score += 10;
    if (profile.workingHours) score += 10;
    if (hasSkills) score += 10;
    if (hasLocation) score += 10;
    return Math.min(100, score);
  }

  async getOwnProfile(workerId: string) {
    let profile = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, workerId),
    });

    if (!user) {
      throw new NotFoundError('Worker user account not found.');
    }

    if (!profile) {
      const defaultName = `Worker ${user.phoneNumber.slice(-4)}`;
      const [newProfile] = await db.insert(workerProfiles).values({
        id: workerId,
        displayName: defaultName,
      }).returning();
      profile = newProfile;
    }

    const skills = await this.getSkills(workerId);

    return {
      id: profile.id,
      displayName: profile.displayName,
      phoneNumber: user.phoneNumber,
      email: user.email,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      experienceYears: Number(profile.experienceYears),
      isVerified: profile.isVerified,
      verificationStatus: profile.verificationStatus,
      isOnline: profile.isOnline,
      serviceRadiusKm: Number(profile.serviceRadiusKm),
      baseVisitingFee: Number(profile.baseVisitingFee),
      workingHours: profile.workingHours,
      latitude: profile.latitude,
      longitude: profile.longitude,
      lastLocationUpdatedAt: profile.lastLocationUpdatedAt,
      averageRating: Number(profile.averageRating),
      totalReviewsCount: profile.totalReviewsCount,
      completedJobsCount: profile.completedJobsCount,
      profileCompletenessPct: profile.profileCompletenessPct,
      skills,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async updateOwnProfile(workerId: string, data: UpdateWorkerProfileInput) {
    const existing = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, workerId),
    });

    if (!user) {
      throw new NotFoundError('Worker account not found.');
    }

    const skillsCount = await db.query.workerSkills.findMany({
      where: eq(workerSkills.workerId, workerId),
    });

    const hasSkills = skillsCount.length > 0;
    const hasLocation = existing ? (existing.latitude !== null && existing.longitude !== null) : false;

    const completeness = this.calculateCompleteness(
      { ...existing, ...data },
      hasSkills,
      hasLocation
    );

    let updated;
    if (existing) {
      const [res] = await db.update(workerProfiles).set({
        displayName: data.displayName,
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.experienceYears !== undefined && { experienceYears: data.experienceYears.toString() }),
        ...(data.serviceRadiusKm !== undefined && { serviceRadiusKm: data.serviceRadiusKm.toString() }),
        ...(data.baseVisitingFee !== undefined && { baseVisitingFee: data.baseVisitingFee.toString() }),
        ...(data.workingHours !== undefined && { workingHours: data.workingHours }),
        profileCompletenessPct: completeness,
        updatedAt: new Date(),
      }).where(eq(workerProfiles.id, workerId)).returning();
      updated = res;
    } else {
      const [res] = await db.insert(workerProfiles).values({
        id: workerId,
        displayName: data.displayName,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        experienceYears: data.experienceYears ? data.experienceYears.toString() : '1.0',
        serviceRadiusKm: data.serviceRadiusKm ? data.serviceRadiusKm.toString() : '10.0',
        baseVisitingFee: data.baseVisitingFee ? data.baseVisitingFee.toString() : '250.00',
        workingHours: data.workingHours,
        profileCompletenessPct: completeness,
      }).returning();
      updated = res;
    }

    return updated;
  }

  async updateAvailability(workerId: string, isOnline: boolean) {
    const profile = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    if (!profile) {
      throw new NotFoundError('Worker profile not found.');
    }

    const [updated] = await db.update(workerProfiles).set({
      isOnline,
      updatedAt: new Date(),
    }).where(eq(workerProfiles.id, workerId)).returning();

    return {
      id: updated.id,
      isOnline: updated.isOnline,
      updatedAt: updated.updatedAt,
    };
  }

  async updateLocation(workerId: string, latitude: number, longitude: number) {
    const profile = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    if (!profile) {
      throw new NotFoundError('Worker profile not found.');
    }

    const [updated] = await db.update(workerProfiles).set({
      latitude,
      longitude,
      lastLocationUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workerProfiles.id, workerId)).returning();

    return {
      id: updated.id,
      latitude: updated.latitude,
      longitude: updated.longitude,
      lastLocationUpdatedAt: updated.lastLocationUpdatedAt,
    };
  }

  async getSkills(workerId: string) {
    const skillsList = await db.select({
      categoryId: workerSkills.categoryId,
      categoryName: serviceCategories.name,
      categorySlug: serviceCategories.slug,
      iconKey: serviceCategories.iconKey,
      experienceMonths: workerSkills.experienceMonths,
    })
      .from(workerSkills)
      .innerJoin(serviceCategories, eq(workerSkills.categoryId, serviceCategories.id))
      .where(eq(workerSkills.workerId, workerId));

    return skillsList;
  }

  async addSkill(workerId: string, input: AddWorkerSkillInput) {
    // Validate category exists and is active
    const category = await db.query.serviceCategories.findFirst({
      where: and(
        eq(serviceCategories.id, input.categoryId),
        eq(serviceCategories.isActive, true)
      ),
    });

    if (!category) {
      throw new BadRequestError('Active service category not found.');
    }

    // Check if skill already exists
    const existing = await db.query.workerSkills.findFirst({
      where: and(
        eq(workerSkills.workerId, workerId),
        eq(workerSkills.categoryId, input.categoryId)
      ),
    });

    if (existing) {
      const [updated] = await db.update(workerSkills).set({
        experienceMonths: input.experienceMonths,
      }).where(and(
        eq(workerSkills.workerId, workerId),
        eq(workerSkills.categoryId, input.categoryId)
      )).returning();
      return updated;
    }

    const [newSkill] = await db.insert(workerSkills).values({
      workerId,
      categoryId: input.categoryId,
      experienceMonths: input.experienceMonths,
    }).returning();

    return newSkill;
  }

  async removeSkill(workerId: string, categoryId: string) {
    await db.delete(workerSkills).where(and(
      eq(workerSkills.workerId, workerId),
      eq(workerSkills.categoryId, categoryId)
    ));
    return { message: 'Skill removed successfully.' };
  }

  async getPublicProfile(workerId: string) {
    const profile = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, workerId),
    });

    if (!profile || !user || user.status !== 'ACTIVE') {
      throw new NotFoundError('Worker profile not found or inactive.');
    }

    const skills = await this.getSkills(workerId);

    // Public sanitized profile: DO NOT leak phone number, email, or exact coordinates
    return {
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      experienceYears: Number(profile.experienceYears),
      isVerified: profile.isVerified,
      isOnline: profile.isOnline,
      serviceRadiusKm: Number(profile.serviceRadiusKm),
      baseVisitingFee: Number(profile.baseVisitingFee),
      workingHours: profile.workingHours,
      averageRating: Number(profile.averageRating),
      totalReviewsCount: profile.totalReviewsCount,
      completedJobsCount: profile.completedJobsCount,
      skills,
    };
  }

  async adminVerifyWorker(workerId: string, isVerified: boolean, verificationStatus: 'UNVERIFIED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED') {
    const profile = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    if (!profile) {
      throw new NotFoundError('Worker profile not found.');
    }

    const [updated] = await db.update(workerProfiles).set({
      isVerified,
      verificationStatus,
      updatedAt: new Date(),
    }).where(eq(workerProfiles.id, workerId)).returning();

    return updated;
  }

  async getDashboardStats(workerId: string) {
    const worker = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });
    const user = await db.query.users.findFirst({
      where: eq(users.id, workerId),
    });

    if (!worker || !user) {
      throw new NotFoundError('Worker account not found.');
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.workerId, workerId),
    });

    let todayEarnings = 0;
    const dailyEarnings = [0, 0, 0, 0, 0, 0, 0];
    let weeklyTotal = 0;

    if (wallet) {
      const txs = await db.query.walletTransactions.findMany({
        where: and(
          eq(walletTransactions.walletId, wallet.id),
          eq(walletTransactions.transactionType, 'EARNING_CREDIT')
        ),
      });

      txs.forEach((t) => {
        const txDate = new Date(t.createdAt);
        const amount = Number(t.amount || 0);

        if (txDate >= startOfToday) {
          todayEarnings += amount;
        }

        const diffDays = Math.floor((now.getTime() - txDate.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays >= 0 && diffDays < 7) {
          dailyEarnings[6 - diffDays] += amount;
          weeklyTotal += amount;
        }
      });
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completedWeek = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(bookings)
      .where(and(
        eq(bookings.workerId, workerId),
        eq(bookings.status, 'COMPLETED'),
        sql`completed_at >= ${oneWeekAgo}`
      ));

    const completedJobsWeek = Number(completedWeek[0]?.count || 0);

    const checklist = {
      skillChosen: Boolean(worker.skill),
      serviceAreaSet: Boolean(worker.serviceArea),
      rateSet: Boolean(Number(worker.hourlyRate || worker.baseVisitingFee) > 0),
      phoneVerified: Boolean(user.isPhoneVerified),
    };

    return {
      todayEarnings,
      completedJobsWeek,
      rating: worker.averageRating ? Number(worker.averageRating) : null,
      reviewCount: worker.totalReviewsCount,
      avgResponseMinutes: worker.avgResponseSeconds ? Math.round(worker.avgResponseSeconds / 60) : 5,
      chartData: dailyEarnings,
      weeklyTotal,
      checklist,
      isOnline: Boolean(worker.isOnline),
    };
  }

  async updateRates(workerId: string, rates: { hourlyRate?: number; baseVisitingFee?: number }) {
    const updateData: any = { updatedAt: new Date() };
    if (rates.hourlyRate != null) updateData.hourlyRate = rates.hourlyRate.toString();
    if (rates.baseVisitingFee != null) updateData.baseVisitingFee = rates.baseVisitingFee.toString();

    const [updated] = await db
      .update(workerProfiles)
      .set(updateData)
      .where(eq(workerProfiles.id, workerId))
      .returning();
    return updated;
  }
}

export const workerService = new WorkerService();
