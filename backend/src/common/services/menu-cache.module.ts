import { Global, Module } from '@nestjs/common';
import { MenuCacheService } from './menu-cache.service';

/** Global (mesmo padrão de PrismaModule) — injetável em qualquer módulo
 *  sem precisar reimportar, já que várias entidades diferentes (Product,
 *  Category, ...) invalidam o mesmo cache do cardápio público. */
@Global()
@Module({
  providers: [MenuCacheService],
  exports: [MenuCacheService],
})
export class MenuCacheModule {}
