import { apiClient } from './client.js';

export const negotiationApi = {
  /**
   * Worker submits estimate (Round 1 or counter)
   */
  async submitEstimate(bookingId, data) {
    const res = await apiClient(`/bookings/${bookingId}/estimate`, {
      method: 'POST',
      body: data,
    });
    return res.data;
  },

  /**
   * Customer responds to estimate (ACCEPT, COUNTER, REJECT)
   */
  async respondToEstimate(bookingId, data) {
    const res = await apiClient(`/bookings/${bookingId}/respond`, {
      method: 'POST',
      body: data,
    });
    return res.data;
  },

  /**
   * Get negotiation rounds history
   */
  async getHistory(bookingId) {
    const res = await apiClient(`/bookings/${bookingId}/negotiation`);
    return res.data;
  },
};
