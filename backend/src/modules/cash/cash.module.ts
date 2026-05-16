import { Module } from "@nestjs/common";

import { PrismaModule } from "src/database/prisma.module";

import { CashController } from "./cash.controller";

import { CashService } from "./cash.service";

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    CashController,
  ],

  providers: [
    CashService,
  ],
})
export class CashModule {}