import { apiClient } from './client.js';

export const bookingApi = {
  /**
   * Create direct booking with chosen worker
   */
  async createDirectBooking(data) {
    const res = await apiClient('/bookings/direct', {
      method: 'POST',
      body: data,
    });
    return res.data;
  },

  /**
   * Create broadcast booking to nearby workers
   */
  async createBroadcastBooking(data) {
    const res = await apiClient('/bookings/broadcast', {
      method: 'POST',
      body: data,
    });
    return res.data;
  },

  /**
   * Worker: Get available broadcast jobs matching skill and radius
   */
  async getAvailableBroadcasts() {
    const res = await apiClient('/bookings/broadcasts/available');
    return res.data;
  },

  /**
   * Worker: Claim broadcast booking
   */
  async claimBroadcastBooking(bookingId) {
    const res = await apiClient(`/bookings/${bookingId}/claim`, {
      method: 'POST',
    });
    return res.data;
  },

  /**
   * Worker: Create offer (accept at budget or counter with price)
   */
  async createOffer(bookingId, { price, kind = 'counter', reason }) {
    const res = await apiClient(`/bookings/${bookingId}/offers`, {
      method: 'POST',
      body: { price: Number(price), kind, reason },
    });
    return res.data;
  },

  /**
   * Get all offers for a job (Customer or Worker)
   */
  async getJobOffers(bookingId) {
    const res = await apiClient(`/bookings/${bookingId}/offers`);
    return res.data;
  },

  /**
   * Customer: Accept a specific worker's offer
   */
  async acceptJobOffer(bookingId, offerId) {
    const res = await apiClient(`/bookings/${bookingId}/offers/${offerId}/accept`, {
      method: 'POST',
    });
    return res.data;
  },

  /**
   * Customer: Reject a specific worker's offer
   */
  async rejectJobOffer(bookingId, offerId) {
    const res = await apiClient(`/bookings/${bookingId}/offers/${offerId}/reject`, {
      method: 'POST',
    });
    return res.data;
  },

  /**
   * Customer: Counter a specific worker's offer
   */
  async counterJobOffer(bookingId, offerId, counterPrice) {
    const res = await apiClient(`/bookings/${bookingId}/offers/${offerId}/counter`, {
      method: 'POST',
      body: { price: Number(counterPrice) },
    });
    return res.data;
  },

  /**
   * Worker: Accept or decline direct booking
   */
  async respondDirectBooking(bookingId, action, declineReason) {
    const res = await apiClient(`/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      body: { action, declineReason },
    });
    return res.data;
  },

  /**
   * Worker: Update status (ON_THE_WAY, ARRIVED, IN_PROGRESS with startCode, PAYMENT_PENDING)
   */
  async updateStatus(bookingId, status, startCode) {
    const res = await apiClient(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: { status, startCode },
    });
    return res.data;
  },

  /**
   * Customer: Confirm completion and trigger simulated payout
   */
  async confirmCompletion(bookingId) {
    const res = await apiClient(`/bookings/${bookingId}/confirm`, {
      method: 'POST',
    });
    return res.data;
  },

  /**
   * Customer or Worker: Cancel booking
   */
  async cancelBooking(bookingId, cancellationReason) {
    const res = await apiClient(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      body: { cancellationReason },
    });
    return res.data;
  },

  /**
   * Get booking details with timeline & status history
   */
  async getBookingDetails(bookingId) {
    const res = await apiClient(`/bookings/${bookingId}`);
    return res.data;
  },

  /**
   * Get live worker tracking bundle for authorized booking
   */
  async getBookingTracking(bookingId) {
    const res = await apiClient(`/bookings/${bookingId}/tracking`);
    return res.data;
  },

  /**
   * Worker: Update live GPS coordinates for active booking
   */
  async updateWorkerLocation(bookingId, { latitude, longitude }) {
    const res = await apiClient(`/bookings/${bookingId}/location`, {
      method: 'PATCH',
      body: { latitude, longitude },
    });
    return res.data;
  },

  /**
   * List customer or worker bookings
   */
  async listBookings(query = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('serviq_access_token') : null;
    if (!token) {
      return { bookings: [], meta: {} };
    }
    try {
      const res = await apiClient('/bookings', {
        params: query,
      });
      return {
        bookings: res?.data || [],
        meta: res?.meta || {},
      };
    } catch {
      return { bookings: [], meta: {} };
    }
  },
};
