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
   * Worker: Get available broadcast jobs in their radius
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
   * Worker: Update status (ARRIVED, IN_PROGRESS, COMPLETED)
   */
  async updateStatus(bookingId, status) {
    const res = await apiClient(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: { status },
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
    const res = await apiClient('/bookings', {
      params: query,
    });
    return {
      bookings: res.data,
      meta: res.meta,
    };
  },
};
