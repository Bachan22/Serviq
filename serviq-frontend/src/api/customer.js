import { apiClient } from './client.js';

export const customerApi = {
  /**
   * Get authenticated customer profile
   */
  async getProfile() {
    const res = await apiClient('/customers/me');
    return res.data;
  },

  /**
   * Update authenticated customer profile
   */
  async updateProfile(data) {
    const res = await apiClient('/customers/me', {
      method: 'PUT',
      body: data,
    });
    return res.data;
  },

  /**
   * List saved addresses
   */
  async getAddresses() {
    const res = await apiClient('/addresses');
    return res.data;
  },

  /**
   * Create a new address
   */
  async createAddress(data) {
    const res = await apiClient('/addresses', {
      method: 'POST',
      body: data,
    });
    return res.data;
  },

  /**
   * Update an address
   */
  async updateAddress(addressId, data) {
    const res = await apiClient(`/addresses/${addressId}`, {
      method: 'PUT',
      body: data,
    });
    return res.data;
  },

  /**
   * Delete an address
   */
  async deleteAddress(addressId) {
    const res = await apiClient(`/addresses/${addressId}`, {
      method: 'DELETE',
    });
    return res.data;
  },

  /**
   * Set address as default
   */
  async setDefaultAddress(addressId) {
    const res = await apiClient(`/addresses/${addressId}/default`, {
      method: 'PATCH',
    });
    return res.data;
  },

  /**
   * Get customer's saved workers
   */
  async getSavedWorkers() {
    const res = await apiClient('/customers/saved-workers');
    return res.data;
  },

  /**
   * Save a worker to favorites
   */
  async saveWorker(workerId) {
    const res = await apiClient(`/customers/saved-workers/${workerId}`, {
      method: 'POST',
    });
    return res.data;
  },

  /**
   * Remove a worker from favorites
   */
  async removeSavedWorker(workerId) {
    const res = await apiClient(`/customers/saved-workers/${workerId}`, {
      method: 'DELETE',
    });
    return res.data;
  },
};
