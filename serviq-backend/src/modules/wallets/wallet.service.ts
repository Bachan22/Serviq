import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../../database/connection';
import { wallets } from '../../database/schema/wallets';
import { walletTransactions } from '../../database/schema/wallet-transactions';
import { payoutRequests } from '../../database/schema/payout-requests';
import { workerProfiles } from '../../database/schema/worker-profiles';
import { BusinessRules } from '../../config/business-rules';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../common/errors/app-error';
import { TopupWalletInput, RequestPayoutInput, ListTransactionsQueryInput } from './wallet.schemas';

export class WalletService {
  async getOrCreateWallet(workerId: string, txClient: any = db) {
    let wallet = await txClient.query.wallets.findFirst({
      where: eq(wallets.workerId, workerId),
    });

    if (!wallet) {
      const [newWallet] = await txClient.insert(wallets).values({
        workerId,
        currentBalance: '0.00',
      }).returning();
      wallet = newWallet;
    }

    return wallet;
  }

  async getWalletDetails(workerId: string) {
    const wallet = await this.getOrCreateWallet(workerId);
    const maxNegativeLimit = BusinessRules.wallet.maxNegativeBalance; // -1500

    return {
      id: wallet.id,
      workerId: wallet.workerId,
      currentBalance: Number(wallet.currentBalance),
      lockedBalance: Number(wallet.lockedBalance),
      totalEarned: Number(wallet.totalEarned),
      totalCommissionPaid: Number(wallet.totalCommissionPaid),
      isFrozen: wallet.isFrozen,
      maxNegativeLimit,
      creditLimitRemaining: Math.max(0, Number(wallet.currentBalance) - maxNegativeLimit),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  async topupWallet(workerId: string, input: TopupWalletInput) {
    return await db.transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(workerId, tx);
      const balanceBefore = Number(wallet.currentBalance);
      const balanceAfter = balanceBefore + input.amount;
      const maxNegativeLimit = BusinessRules.wallet.maxNegativeBalance; // -1500
      const isFrozen = balanceAfter < maxNegativeLimit;

      const [updatedWallet] = await tx.update(wallets).set({
        currentBalance: balanceAfter.toFixed(2),
        isFrozen,
        updatedAt: new Date(),
      }).where(eq(wallets.id, wallet.id)).returning();

      const [transaction] = await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        transactionType: 'WALLET_TOPUP',
        amount: input.amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        referenceId: input.referenceId || `TOPUP-${Date.now().toString().slice(-6)}`,
        description: `Wallet recharge of ₹${input.amount}`,
      }).returning();

      return {
        wallet: updatedWallet,
        transaction,
      };
    });
  }

  async recordCommissionDeduction(txClient: any, workerId: string, bookingId: string | null, commissionAmount: number) {
    const wallet = await this.getOrCreateWallet(workerId, txClient);
    const balanceBefore = Number(wallet.currentBalance);
    const balanceAfter = balanceBefore - commissionAmount;
    const maxNegativeLimit = BusinessRules.wallet.maxNegativeBalance; // default -1500
    const isFrozen = balanceAfter < maxNegativeLimit;

    const [updatedWallet] = await txClient.update(wallets).set({
      currentBalance: balanceAfter.toFixed(2),
      totalCommissionPaid: (Number(wallet.totalCommissionPaid) + commissionAmount).toFixed(2),
      isFrozen,
      updatedAt: new Date(),
    }).where(eq(wallets.id, wallet.id)).returning();

    await txClient.insert(walletTransactions).values({
      walletId: wallet.id,
      bookingId: bookingId || null,
      transactionType: 'COMMISSION_DEDUCTION',
      amount: (-commissionAmount).toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      description: `10% platform commission on labor for booking`,
    });

    return updatedWallet;
  }

  async recordCancellationCompensation(txClient: any, workerId: string, bookingId: string, amount: number) {
    const wallet = await this.getOrCreateWallet(workerId, txClient);
    const balanceBefore = Number(wallet.currentBalance);
    const balanceAfter = balanceBefore + amount;

    const [updatedWallet] = await txClient.update(wallets).set({
      currentBalance: balanceAfter.toFixed(2),
      totalEarned: (Number(wallet.totalEarned) + amount).toFixed(2),
      updatedAt: new Date(),
    }).where(eq(wallets.id, wallet.id)).returning();

    await txClient.insert(walletTransactions).values({
      walletId: wallet.id,
      bookingId,
      transactionType: 'CANCELLATION_COMPENSATION',
      amount: amount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      description: `Worker share (85%) of customer cancellation trip fee`,
    });

    return updatedWallet;
  }

  async recordOnlinePayout(txClient: any, workerId: string, bookingId: string, netPayoutAmount: number) {
    const wallet = await this.getOrCreateWallet(workerId, txClient);
    const balanceBefore = Number(wallet.currentBalance);
    const balanceAfter = balanceBefore + netPayoutAmount;

    const [updatedWallet] = await txClient.update(wallets).set({
      currentBalance: balanceAfter.toFixed(2),
      totalEarned: (Number(wallet.totalEarned) + netPayoutAmount).toFixed(2),
      updatedAt: new Date(),
    }).where(eq(wallets.id, wallet.id)).returning();

    await txClient.insert(walletTransactions).values({
      walletId: wallet.id,
      bookingId,
      transactionType: 'ONLINE_PAYOUT',
      amount: netPayoutAmount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      description: `Net payout for online payment (labor after commission + parts)`,
    });

    return updatedWallet;
  }

  async requestPayout(workerId: string, input: RequestPayoutInput) {
    return await db.transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(workerId, tx);
      const balance = Number(wallet.currentBalance);

      if (balance < input.amount) {
        throw new BadRequestError(`Insufficient positive wallet balance. Current balance is ₹${balance}, requested ₹${input.amount}.`);
      }

      if (wallet.isFrozen) {
        throw new ForbiddenError('Wallet is currently frozen. Payouts cannot be processed.');
      }

      const balanceBefore = balance;
      const balanceAfter = balance - input.amount;

      // Deduct balance
      await tx.update(wallets).set({
        currentBalance: balanceAfter.toFixed(2),
        updatedAt: new Date(),
      }).where(eq(wallets.id, wallet.id));

      // Record withdrawal transaction
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        transactionType: 'WITHDRAWAL',
        amount: (-input.amount).toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description: `Payout withdrawal via ${input.payoutMethod}`,
      });

      // Create payout request
      const [payout] = await tx.insert(payoutRequests).values({
        workerId,
        amount: input.amount.toFixed(2),
        status: 'REQUESTED',
        payoutMethod: input.payoutMethod,
        payoutDetails: input.payoutDetails,
      }).returning();

      return payout;
    });
  }

  async listTransactions(workerId: string, query: ListTransactionsQueryInput) {
    const wallet = await this.getOrCreateWallet(workerId);
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const list = await db.query.walletTransactions.findMany({
      where: eq(walletTransactions.walletId, wallet.id),
      orderBy: [desc(walletTransactions.createdAt)],
      limit,
      offset,
    });

    const [countResult] = await db.select({ count: sql`COUNT(*)::int` })
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id));

    const total = Number(countResult?.count || 0);

    return {
      transactions: list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listPayoutRequests(workerId: string) {
    const list = await db.query.payoutRequests.findMany({
      where: eq(payoutRequests.workerId, workerId),
      orderBy: [desc(payoutRequests.createdAt)],
    });
    return list;
  }
}

export const walletService = new WalletService();
