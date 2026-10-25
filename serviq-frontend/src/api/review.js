import { apiClient } from './client.js';

export const reviewApi = {
  /**
   * Submit a rating and review for a completed booking (Customer only)
   */
  async createReview({ bookingId, rating, comment, isPublic = true }) {
    const res = await apiClient('/reviews', {
      method: 'POST',
      body: { bookingId, rating, comment, isPublic },
    });
    return res.data;
  },

  /**
   * Worker reply to a customer review
   */
  async replyToReview(reviewId, reply) {
    const res = await apiClient(`/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: { reply },
    });
    return res.data;
  },

  /**
   * Fetch public reviews and rating summary for a worker
   */
  async getWorkerReviews(workerId, page = 1, limit = 10) {
    const res = await apiClient(`/workers/${workerId}/reviews?page=${page}&limit=${limit}`);
    return res.data;
  },
};

