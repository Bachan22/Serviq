import { apiClient } from './client.js';

export const workerApi = {
  /**
   * Get authenticated worker profile
   */
  async getProfile() {
    const res = await apiClient('/workers/me');
    return res.data;
  },

  /**
   * Update authenticated worker profile
   */
  async updateProfile(data) {
    const res = await apiClient('/workers/me', {
      method: 'PUT',
      body: data,
    });
    return res.data;
  },

  /**
   * Toggle online/offline status
   */
  async updateAvailability(isOnline) {
    const res = await apiClient('/workers/availability', {
      method: 'PATCH',
      body: { isOnline },
    });
    return res.data;
  },

  /**
   * Update real-time GPS location
   */
  async updateLocation(latitude, longitude) {
    const res = await apiClient('/workers/location', {
      method: 'PATCH',
      body: { latitude, longitude },
    });
    return res.data;
  },

  /**
   * Get worker skills
   */
  async getSkills() {
    const res = await apiClient('/workers/skills');
    return res.data;
  },

  /**
   * Add a skill/category
   */
  async addSkill(categoryId, experienceMonths = 12) {
    const res = await apiClient('/workers/skills', {
      method: 'POST',
      body: { categoryId, experienceMonths },
    });
    return res.data;
  },

  /**
   * Remove a skill
   */
  async removeSkill(categoryId) {
    const res = await apiClient(`/workers/skills/${categoryId}`, {
      method: 'DELETE',
    });
    return res.data;
  },

  /**
   * Get public sanitized worker profile
   */
  async getPublicProfile(workerId) {
    const res = await apiClient(`/workers/${workerId}`);
    return res.data;
  },
};
