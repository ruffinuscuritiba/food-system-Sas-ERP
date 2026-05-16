import { SetMetadata } from '@nestjs/common';

export const Module =
  (module: string) =>
    SetMetadata(
      'requiredModule',
      module,
    );