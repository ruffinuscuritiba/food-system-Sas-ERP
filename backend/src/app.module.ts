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
import { ReportsModule } from './modules/reports/reports.module'
import { IaModule } from './modules/ia/ia.module'
import { LoyaltyModule } from './modules/loyalty/loyalty.module'
import { SmartImportModule } from './modules/smart-import/smart-import.module'
import { PizzaBordersModule } from './modules/pizza-borders/pizza-borders.module'
import { PizzaSizeConfigsModule } from './modules/pizza-size-configs/pizza-size-configs.module'
import { ComplementsModule } from './modules/complements/complements.module'
import { OnlineOrdersModule } from './modules/online-orders/online-orders.module'
import { WhatsappAiModule } from './modules/whatsapp-ai/whatsapp-ai.module'
import { IngredientsModule } from './modules/ingredients/ingredients.module'
import { RecipesModule } from './modules/recipes/recipes.module'
import { StockModule } from './modules/stock/stock.module'
import { DriversModule } from './modules/drivers/drivers.module'
import { FinancialModule } from './modules/financial/financial.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

// NOTE: Modules disabled temporarily due to schema/code mismatch
// (will be re-enabled after backend cleanup):
// - PaymentsModule, LoyaltyModule, ChatModule, DriversModule,
// - DeliveryConfigModule, TrackingModule, AlertsModule

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
    ReportsModule,
    IaModule,
    LoyaltyModule,
    SmartImportModule,
    PizzaBordersModule,
    PizzaSizeConfigsModule,
    ComplementsModule,
    OnlineOrdersModule,
    WhatsappAiModule,
    IngredientsModule,
    RecipesModule,
    StockModule,
    DriversModule,
    FinancialModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
