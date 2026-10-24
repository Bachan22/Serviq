import { FastifyRequest, FastifyReply } from 'fastify';
import { walletService } from './wallet.service';
import {
  topupWalletSchema,
  requestPayoutSchema,
  listTransactionsQuerySchema,
} from './wallet.schemas';

export class WalletController {
  async getMyWallet(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const wallet = await walletService.getWalletDetails(workerId);
    return reply.status(200).send({
      success: true,
      data: wallet,
    });
  }

  async topupWallet(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const input = topupWalletSchema.parse(request.body);
    const result = await walletService.topupWallet(workerId, input);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async requestPayout(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const input = requestPayoutSchema.parse(request.body);
    const payout = await walletService.requestPayout(workerId, input);
    return reply.status(201).send({
      success: true,
      data: payout,
    });
  }

  async listTransactions(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const query = listTransactionsQuerySchema.parse(request.query);
    const result = await walletService.listTransactions(workerId, query);
    return reply.status(200).send({
      success: true,
      data: result.transactions,
      meta: result.pagination,
    });
  }

  async listPayoutRequests(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const payouts = await walletService.listPayoutRequests(workerId);
    return reply.status(200).send({
      success: true,
      data: payouts,
    });
  }
}

export const walletController = new WalletController();
