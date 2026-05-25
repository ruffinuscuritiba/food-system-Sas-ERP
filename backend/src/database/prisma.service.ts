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
  private _ready = false
  private _readyPromise: Promise<void>
  private _resolveReady!: () => void

  constructor() {
    super()
    this._readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve
    })
  }

  get isReady() { return this._ready }
  get readyPromise() { return this._readyPromise }

  async onModuleInit() {
    let retries = 8
    while (retries > 0) {
      try {
        await this.$connect()
        this._ready = true
        this._resolveReady()
        return
      } catch (err) {
        retries--
        if (retries === 0) throw err
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close()
    })
  }
}
