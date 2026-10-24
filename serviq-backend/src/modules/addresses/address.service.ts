import { eq, and } from 'drizzle-orm';
import { db } from '../../database/connection';
import { addresses } from '../../database/schema/addresses';
import { customerProfiles } from '../../database/schema/customer-profiles';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error';
import { CreateAddressInput, UpdateAddressInput } from './address.schemas';

export class AddressService {
  private async ensureCustomerProfile(customerId: string) {
    const profile = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.id, customerId),
    });
    if (!profile) {
      await db.insert(customerProfiles).values({
        id: customerId,
        displayName: 'Customer',
      });
    }
  }

  async listAddresses(customerId: string) {
    await this.ensureCustomerProfile(customerId);
    const list = await db.query.addresses.findMany({
      where: eq(addresses.customerId, customerId),
      orderBy: (addr, { desc }) => [desc(addr.isDefault), desc(addr.createdAt)],
    });

    return list.map((a) => ({
      id: a.id,
      addressLabel: a.addressLabel,
      recipientName: a.recipientName,
      recipientPhone: a.recipientPhone,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      locality: a.locality,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      latitude: a.latitude,
      longitude: a.longitude,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
    }));
  }

  async createAddress(customerId: string, data: CreateAddressInput) {
    await this.ensureCustomerProfile(customerId);

    // Check if customer has any existing addresses
    const existingAddresses = await db.query.addresses.findMany({
      where: eq(addresses.customerId, customerId),
    });

    // If it's the first address, force isDefault to true
    const shouldBeDefault = existingAddresses.length === 0 ? true : Boolean(data.isDefault);

    // Atomic transaction: if new address is default, unset previous default first
    return await db.transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.update(addresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(addresses.customerId, customerId), eq(addresses.isDefault, true)));
      }

      const [newAddress] = await tx.insert(addresses).values({
        customerId,
        addressLabel: data.addressLabel,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        locality: data.locality,
        city: data.city,
        state: data.state || 'Maharashtra',
        postalCode: data.postalCode,
        latitude: data.latitude,
        longitude: data.longitude,
        isDefault: shouldBeDefault,
      }).returning();

      return newAddress;
    });
  }

  async updateAddress(customerId: string, addressId: string, data: UpdateAddressInput) {
    const existing = await db.query.addresses.findFirst({
      where: eq(addresses.id, addressId),
    });

    if (!existing) {
      throw new NotFoundError('Address not found.');
    }

    if (existing.customerId !== customerId) {
      throw new ForbiddenError('You do not have permission to modify this address.');
    }

    return await db.transaction(async (tx) => {
      if (data.isDefault) {
        // Unset previous default
        await tx.update(addresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(addresses.customerId, customerId), eq(addresses.isDefault, true)));
      }

      const [updated] = await tx.update(addresses).set({
        ...(data.addressLabel && { addressLabel: data.addressLabel }),
        ...(data.recipientName !== undefined && { recipientName: data.recipientName }),
        ...(data.recipientPhone !== undefined && { recipientPhone: data.recipientPhone }),
        ...(data.addressLine1 && { addressLine1: data.addressLine1 }),
        ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 }),
        ...(data.locality && { locality: data.locality }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state }),
        ...(data.postalCode && { postalCode: data.postalCode }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        updatedAt: new Date(),
      }).where(eq(addresses.id, addressId)).returning();

      return updated;
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const existing = await db.query.addresses.findFirst({
      where: eq(addresses.id, addressId),
    });

    if (!existing) {
      throw new NotFoundError('Address not found.');
    }

    if (existing.customerId !== customerId) {
      throw new ForbiddenError('You do not have permission to delete this address.');
    }

    await db.delete(addresses).where(eq(addresses.id, addressId));
    return { message: 'Address deleted successfully.' };
  }

  async setDefaultAddress(customerId: string, addressId: string) {
    const existing = await db.query.addresses.findFirst({
      where: eq(addresses.id, addressId),
    });

    if (!existing) {
      throw new NotFoundError('Address not found.');
    }

    if (existing.customerId !== customerId) {
      throw new ForbiddenError('You do not have permission to modify this address.');
    }

    return await db.transaction(async (tx) => {
      // Unset previous default
      await tx.update(addresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(addresses.customerId, customerId), eq(addresses.isDefault, true)));

      // Set new default
      const [updated] = await tx.update(addresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(addresses.id, addressId))
        .returning();

      return updated;
    });
  }
}

export const addressService = new AddressService();
