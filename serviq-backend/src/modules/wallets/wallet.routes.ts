import { FastifyInstance } from 'fastify';
import { walletController } from './wallet.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function walletRoutes(fastify: FastifyInstance) {
  // Get authenticated worker wallet summary & negative credit limit
  fastify.get('/me', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: walletController.getMyWallet.bind(walletController),
  });

  // Worker wallet recharge / topup
  fastify.post('/me/topup', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: walletController.topupWallet.bind(walletController),
  });

  // Request payout withdrawal
  fastify.post('/me/payouts', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: walletController.requestPayout.bind(walletController),
  });

  // List past payout requests
  fastify.get('/me/payouts', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: walletController.listPayoutRequests.bind(walletController),
  });

  // List wallet ledger transactions
  fastify.get('/me/transactions', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: walletController.listTransactions.bind(walletController),
  });
}
