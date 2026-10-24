import { apiClient } from './client.js';

export const walletApi = {
  /**
   * Get authenticated worker wallet summary & negative credit limit
   */
  async getMyWallet() {
    const res = await apiClient('/wallets/me');
    return res.data;
  },

  /**
   * Top-up / recharge worker wallet
   */
  async topupWallet(amount, referenceId) {
    const res = await apiClient('/wallets/me/topup', {
      method: 'POST',
      body: { amount, referenceId },
    });
    return res.data;
  },

  /**
   * Request withdrawal payout
   */
  async requestPayout(amount, payoutMethod, payoutDetails) {
    const res = await apiClient('/wallets/me/payouts', {
      method: 'POST',
      body: { amount, payoutMethod, payoutDetails },
    });
    return res.data;
  },

  /**
   * List past withdrawal payout requests
   */
  async listPayoutRequests() {
    const res = await apiClient('/wallets/me/payouts');
    return res.data;
  },

  /**
   * List wallet transactions ledger
   */
  async listTransactions(query = {}) {
    const res = await apiClient('/wallets/me/transactions', {
      params: query,
    });
    return {
      transactions: res.data,
      meta: res.meta,
    };
  },
};
