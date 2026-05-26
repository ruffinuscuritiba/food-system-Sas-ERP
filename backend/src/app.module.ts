import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { PrismaModule } from './database/prisma.module'

import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { ProductsModule } from './modules/products/products.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { OrdersModule } from './modules/orders/orders.module'
import { TablesModule } from './modules/tables/tables.module'
import { CashModule } from './modules/cash/cash.module'
import { ThemesModule } from './modules/themes/themes.module'
import { CompanyModule } from './modules/company/company.module'
import { AuditModule } from './modules/audit/audit.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { LoyaltyModule } from './modules/loyalty/loyalty.module'
import { ChatModule } from './modules/chat/chat.module'
import { PaymentModule } from './modules/payment/payment.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    TablesModule,
    CashModule,
    ThemesModule,
    CompanyModule,
    NotificationsModule,
    PaymentsModule,
    LoyaltyModule,
    ChatModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}