import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ADMIN_CONTROLLER_KEY, PERMISSIONS_KEY } from './decorators';

/**
 * Fails application startup if any admin route lacks @RequirePermissions, so a new
 * admin endpoint can never be shipped without authorization by accident.
 */
@Injectable()
export class AdminRouteAuditor implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminRouteAuditor.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const unprotected: string[] = [];
    let checked = 0;
    for (const wrapper of this.discovery.getControllers()) {
      const { metatype, instance } = wrapper;
      if (!metatype || !instance || !this.reflector.get<boolean>(ADMIN_CONTROLLER_KEY, metatype))
        continue;
      const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        checked += 1;
        const permissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
          handler,
          metatype,
        ]);
        if (!permissions?.length) unprotected.push(`${metatype.name}.${name}`);
      }
    }
    if (unprotected.length > 0) {
      throw new Error(`Admin routes without @RequirePermissions: ${unprotected.join(', ')}`);
    }
    this.logger.log(`${checked} admin routes verified to require permissions`);
  }
}
