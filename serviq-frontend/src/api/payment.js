import { apiClient } from './client.js';

export const paymentApi = {
  /**
   * Process and settle payment (Cash on Delivery or Online UPI/Card)
   */
  async processPayment(bookingId, paymentMethod, gatewayPaymentId) {
    const res = await apiClient('/payments/process', {
      method: 'POST',
      body: { bookingId, paymentMethod, gatewayPaymentId },
    });
    return res.data;
  },

  /**
   * Get payment receipt for a booking
   */
  async getReceipt(bookingId) {
    const res = await apiClient(`/payments/booking/${bookingId}`);
    return res.data;
  },
};
