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
};
