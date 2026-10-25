import { apiClient } from './client.js';

export const notificationApi = {
  /**
   * Get authenticated user notifications
   */
  async getNotifications() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('serviq_access_token') : null;
    if (!token) return [];
    try {
      const res = await apiClient('/notifications');
      return res?.data || [];
    } catch {
      return [];
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId) {
    const res = await apiClient(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
    return res.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    const res = await apiClient('/notifications/read-all', {
      method: 'POST',
    });
    return res.data;
  },
};
