import { Injectable } from '@nestjs/common';
import type { AddressUpsertInput, AddressView } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toAddressView } from './address.mapper';

const MAX_ADDRESSES = 20;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AddressView[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return addresses.map(toAddressView);
  }

  async create(userId: string, input: AddressUpsertInput): Promise<AddressView> {
    const count = await this.prisma.address.count({ where: { userId, deletedAt: null } });
    if (count >= MAX_ADDRESSES) throw AppException.conflict(`حداکثر ${MAX_ADDRESSES} آدرس قابل ثبت است.`);
    const address = await this.prisma.$transaction(async (tx) => {
      const isDefault = input.isDefault || count === 0;
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...input, isDefault, userId } });
    });
    return toAddressView(address);
  }

  async update(userId: string, id: string, input: AddressUpsertInput): Promise<AddressView> {
    await this.own(userId, id);
    const address = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: input });
    });
    return toAddressView(address);
  }

  async setDefault(userId: string, id: string): Promise<AddressView[]> {
    await this.own(userId, id);
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.list(userId);
  }

  /** Soft delete: past orders keep their own address snapshot anyway. */
  async remove(userId: string, id: string): Promise<void> {
    const address = await this.own(userId, id);
    await this.prisma.address.update({ where: { id }, data: { deletedAt: new Date(), isDefault: false } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  private async own(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!address) throw AppException.notFound('آدرس یافت نشد.');
    return address;
  }
}
