import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../database/connection';
import { workerDocuments } from '../../database/schema/worker-documents';
import { workerProfiles } from '../../database/schema/worker-profiles';
import { customerProfiles } from '../../database/schema/customer-profiles';
import { bookings } from '../../database/schema/bookings';
import { payments } from '../../database/schema/payments';
import { users } from '../../database/schema/users';
import {
  NotFoundError,
  BadRequestError,
} from '../../common/errors/app-error';
import {
  SubmitWorkerDocumentInput,
  ReviewWorkerDocumentInput,
  VerifyWorkerProfileInput,
} from './admin.schemas';

export class AdminService {
  async submitDocument(workerId: string, input: SubmitWorkerDocumentInput) {
    const worker = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    if (!worker) {
      throw new NotFoundError('Worker profile not found.');
    }

    return await db.transaction(async (tx) => {
      const [doc] = await tx.insert(workerDocuments).values({
        workerId,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        documentUrl: input.documentUrl,
        verificationStatus: 'PENDING',
      }).returning();

      // If worker status is UNVERIFIED, transition to PENDING_REVIEW
      if (worker.verificationStatus === 'UNVERIFIED' || worker.verificationStatus === 'REJECTED') {
        await tx.update(workerProfiles).set({
          verificationStatus: 'PENDING_REVIEW',
          updatedAt: new Date(),
        }).where(eq(workerProfiles.id, workerId));
      }

      return doc;
    });
  }

  async getWorkerDocuments(workerId: string) {
    const docs = await db.query.workerDocuments.findMany({
      where: eq(workerDocuments.workerId, workerId),
      orderBy: [desc(workerDocuments.createdAt)],
    });
    return docs;
  }

  async listPendingVerifications() {
    const pendingDocs = await db.select({
      documentId: workerDocuments.id,
      workerId: workerDocuments.workerId,
      workerDisplayName: workerProfiles.displayName,
      experienceYears: workerProfiles.experienceYears,
      documentType: workerDocuments.documentType,
      documentNumber: workerDocuments.documentNumber,
      documentUrl: workerDocuments.documentUrl,
      submittedAt: workerDocuments.createdAt,
    })
      .from(workerDocuments)
      .innerJoin(workerProfiles, eq(workerDocuments.workerId, workerProfiles.id))
      .where(eq(workerDocuments.verificationStatus, 'PENDING'))
      .orderBy(desc(workerDocuments.createdAt));

    return pendingDocs;
  }

  async reviewDocument(adminId: string, documentId: string, input: ReviewWorkerDocumentInput) {
    const doc = await db.query.workerDocuments.findFirst({
      where: eq(workerDocuments.id, documentId),
    });

    if (!doc) {
      throw new NotFoundError('Document not found.');
    }

    const newStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const [updated] = await db.update(workerDocuments).set({
      verificationStatus: newStatus,
      rejectionReason: input.rejectionReason,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workerDocuments.id, documentId)).returning();

    return updated;
  }

  async verifyWorker(adminId: string, workerId: string, input: VerifyWorkerProfileInput) {
    const worker = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });

    if (!worker) {
      throw new NotFoundError('Worker profile not found.');
    }

    const isApproved = input.action === 'APPROVE';
    const status = isApproved ? 'APPROVED' : 'REJECTED';

    const [updated] = await db.update(workerProfiles).set({
      isVerified: isApproved,
      verificationStatus: status,
      updatedAt: new Date(),
    }).where(eq(workerProfiles.id, workerId)).returning();

    return updated;
  }

  async getPlatformMetrics() {
    const [customerCount] = await db.select({ count: sql`COUNT(*)::int` }).from(customerProfiles);
    const [workerCount] = await db.select({ count: sql`COUNT(*)::int` }).from(workerProfiles);
    const [verifiedWorkerCount] = await db.select({ count: sql`COUNT(*)::int` })
      .from(workerProfiles)
      .where(eq(workerProfiles.isVerified, true));
    const [bookingCount] = await db.select({ count: sql`COUNT(*)::int` }).from(bookings);
    const [activeBookingCount] = await db.select({ count: sql`COUNT(*)::int` })
      .from(bookings)
      .where(sql`status NOT IN ('COMPLETED', 'CANCELLED')`);

    const [financials] = await db.select({
      totalGmv: sql`COALESCE(SUM(${payments.amount})::numeric(12, 2), 0.00)`,
      totalCommission: sql`COALESCE(SUM(${payments.platformCommission})::numeric(12, 2), 0.00)`,
    })
      .from(payments)
      .where(eq(payments.status, 'SUCCESS'));

    return {
      totalCustomers: Number(customerCount?.count || 0),
      totalWorkers: Number(workerCount?.count || 0),
      verifiedWorkers: Number(verifiedWorkerCount?.count || 0),
      totalBookings: Number(bookingCount?.count || 0),
      activeBookings: Number(activeBookingCount?.count || 0),
      financialOverview: {
        totalGmv: Number(financials?.totalGmv || 0),
        totalPlatformCommission: Number(financials?.totalCommission || 0),
      },
    };
  }
}

export const adminService = new AdminService();
