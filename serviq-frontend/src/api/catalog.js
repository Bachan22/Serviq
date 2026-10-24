import { apiClient } from './client.js';

export const catalogApi = {
  /**
   * Fetch active service categories
   */
  async getCategories(includeInactive = false) {
    const res = await apiClient('/categories', {
      params: includeInactive ? { includeInactive: true } : undefined,
    });
    return res.data;
  },

  /**
   * Fetch single category by slug with its subcategories
   */
  async getCategoryBySlug(slug) {
    const res = await apiClient(`/categories/${slug}`);
    return res.data;
  },
};
