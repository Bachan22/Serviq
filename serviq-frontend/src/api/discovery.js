import { apiClient } from './client.js';

export const discoveryApi = {
  /**
   * Search nearby workers via PostGIS
   * @param {Object} options
   * @param {number} options.latitude
   * @param {number} options.longitude
   * @param {number} [options.radiusKm=10]
   * @param {string} [options.category]
   * @param {boolean} [options.availableNow=false]
   * @param {number} [options.minRating]
   * @param {number} [options.maxPrice]
   * @param {string} [options.sortBy='distance']
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   */
  async searchWorkers(options) {
    const res = await apiClient('/workers/search', {
      params: options,
    });
    return {
      workers: res.data,
      meta: res.meta,
    };
  },
};
