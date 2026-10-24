import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../database/connection';
import { reviews } from '../../database/schema/reviews';
import { bookings } from '../../database/schema/bookings';
import { workerProfiles } from '../../database/schema/worker-profiles';
import { customerProfiles } from '../../database/schema/customer-profiles';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../common/errors/app-error';
import { CreateReviewInput, ReplyReviewInput, ListReviewsQueryInput } from './review.schemas';

export class ReviewService {
  async createReview(customerId: string, input: CreateReviewInput) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, input.bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenError('You can only review services completed for your own account.');
    }

    if (booking.status !== 'COMPLETED') {
      throw new BadRequestError('Only completed service bookings can be reviewed.');
    }

    if (!booking.workerId) {
      throw new BadRequestError('No service professional assigned to review.');
    }

    // Check if review already submitted
    const existing = await db.query.reviews.findFirst({
      where: eq(reviews.bookingId, input.bookingId),
    });

    if (existing) {
      throw new ConflictError('A review has already been submitted for this service booking.', 'DUPLICATE_REVIEW');
    }

    return await db.transaction(async (tx) => {
      // 1. Insert review
      const [newReview] = await tx.insert(reviews).values({
        bookingId: input.bookingId,
        customerId,
        workerId: booking.workerId!,
        rating: input.rating,
        reviewText: input.reviewText,
        categoryRatings: input.categoryRatings || {},
        isPublished: true,
      }).returning();

      // 2. Re-calculate worker rating statistics
      const [stats] = await tx.select({
        avgRating: sql<string>`COALESCE(ROUND(AVG(${reviews.rating})::numeric, 2), 0.00)::text`,
        count: sql<number>`COUNT(*)::int`,
      })
        .from(reviews)
        .where(and(
          eq(reviews.workerId, booking.workerId!),
          eq(reviews.isPublished, true)
        ));

      const avgRatingStr = stats?.avgRating || '0.00';
      const countNum = Number(stats?.count || 0);

      // 3. Update worker profile with new average rating and count
      await tx.update(workerProfiles).set({
        averageRating: avgRatingStr,
        totalReviewsCount: countNum,
        updatedAt: new Date(),
      }).where(eq(workerProfiles.id, booking.workerId!));

      return {
        review: newReview,
        updatedWorkerStats: {
          averageRating: Number(avgRatingStr),
          totalReviewsCount: countNum,
        },
      };
    });
  }

  async replyToReview(workerId: string, reviewId: string, input: ReplyReviewInput) {
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review not found.');
    }

    if (review.workerId !== workerId) {
      throw new ForbiddenError('You can only reply to reviews on your own profile.');
    }

    const [updated] = await db.update(reviews).set({
      workerReply: input.workerReply,
      workerRepliedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(reviews.id, reviewId)).returning();

    return updated;
  }

  async getWorkerReviews(workerId: string, query: ListReviewsQueryInput) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const list = await db.select({
      id: reviews.id,
      rating: reviews.rating,
      reviewText: reviews.reviewText,
      categoryRatings: reviews.categoryRatings,
      workerReply: reviews.workerReply,
      workerRepliedAt: reviews.workerRepliedAt,
      createdAt: reviews.createdAt,
      customerDisplayName: customerProfiles.displayName,
      customerAvatarUrl: customerProfiles.avatarUrl,
    })
      .from(reviews)
      .innerJoin(customerProfiles, eq(reviews.customerId, customerProfiles.id))
      .where(and(
        eq(reviews.workerId, workerId),
        eq(reviews.isPublished, true)
      ))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql`COUNT(*)::int` })
      .from(reviews)
      .where(and(
        eq(reviews.workerId, workerId),
        eq(reviews.isPublished, true)
      ));

    const total = Number(countResult?.count || 0);

    return {
      reviews: list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const reviewService = new ReviewService();
