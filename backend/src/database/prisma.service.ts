import {
  INestApplication,
  Injectable,
  OnModuleInit,
} from '@nestjs/common'

import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit
{
  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  async enableShutdownHooks(
    app: INestApplication,
  ) {
    process.on(
      'beforeExit',
      async () => {
        await app.close()
      },
    )
  }
}