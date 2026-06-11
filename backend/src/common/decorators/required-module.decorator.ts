import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE_KEY = 'requiredModule';

/**
 * Marks a controller/handler as requiring a module to be ACTIVE or TRIAL.
 * Works together with ModuleGuard.
 *
 * Usage: @RequiredModule('delivery')
 */
export const RequiredModule = (slug: string) =>
  SetMetadata(REQUIRED_MODULE_KEY, slug);
