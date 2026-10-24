import { apiClient } from './client.js';

export const adminApi = {
  /**
   * Upload / submit an identity document for worker verification (Worker only)
   */
  async submitDocument({ documentType, documentNumber, documentUrl }) {
    const res = await apiClient('/admin/documents', {
      method: 'POST',
      body: { documentType, documentNumber, documentUrl },
    });
    return res.data;
  },

  /**
   * Fetch current worker's uploaded verification documents
   */
  async getMyDocuments() {
    const res = await apiClient('/admin/documents/mine');
    return res.data;
  },

  /**
   * List pending verification documents in admin review queue (Admin only)
   */
  async listPendingVerifications(status = 'PENDING', page = 1, limit = 20) {
    const res = await apiClient(`/admin/verifications?status=${status}&page=${page}&limit=${limit}`);
    return res.data;
  },

  /**
   * Approve or reject a worker verification document (Admin only)
   */
  async reviewDocument(documentId, { status, rejectionReason }) {
    const res = await apiClient(`/admin/documents/${documentId}/review`, {
      method: 'POST',
      body: { status, rejectionReason },
    });
    return res.data;
  },

  /**
   * Officially mark worker profile as verified/unverified (Admin only)
   */
  async verifyWorker(workerId, { isVerified, remarks }) {
    const res = await apiClient(`/admin/workers/${workerId}/verify`, {
      method: 'POST',
      body: { isVerified, remarks },
    });
    return res.data;
  },

  /**
   * Fetch real-time operational platform metrics & financial totals (Admin only)
   */
  async getPlatformMetrics() {
    const res = await apiClient('/admin/metrics');
    return res.data;
  },
};
