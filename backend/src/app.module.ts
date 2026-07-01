import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './database/prisma.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TablesModule } from './modules/tables/tables.module';
import { CashModule } from './modules/cash/cash.module';
import { ThemesModule } from './modules/themes/themes.module';
import { CompanyModule } from './modules/company/company.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IaModule } from './modules/ia/ia.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { SmartImportModule } from './modules/smart-import/smart-import.module';
import { PizzaBordersModule } from './modules/pizza-borders/pizza-borders.module';
import { PizzaSizeConfigsModule } from './modules/pizza-size-configs/pizza-size-configs.module';
import { ComplementsModule } from './modules/complements/complements.module';
import { OnlineOrdersModule } from './modules/online-orders/online-orders.module';
import { WhatsappAiModule } from './modules/whatsapp-ai/whatsapp-ai.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { StockModule } from './modules/stock/stock.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { DeliveryConfigModule } from './modules/delivery-config/delivery-config.module';
import { FinancialModule } from './modules/financial/financial.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { CompanyModuleModule } from './company-module/company-module.module';
import { LeadsModule } from './modules/leads/leads.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PrintersModule } from './modules/printers/printers.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DemoGuard } from './common/guards/demo.guard';
import { RetentionModule } from './modules/retention/retention.module';
import { SegmentSeedModule } from './modules/segment-seed/segment-seed.module';
import { LayoutTemplatesModule } from './modules/layout-templates/layout-templates.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { VisitsModule } from './modules/visits/visits.module';
import { QrCampaignsModule } from './modules/qr-campaigns/qr-campaigns.module';
import { UploadModule } from './modules/upload/upload.module';

// NOTE: Modules disabled temporarily due to schema/code mismatch:
// - ChatModule, AlertsModule

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),

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
    TrackingModule,
    DeliveryConfigModule,
    FinancialModule,
    MarketingModule,
    SuperAdminModule,
    CompanyModuleModule,
    LeadsModule,
    PaymentsModule,
    IntegrationsModule,
    PrintersModule,
    RetentionModule,
    SegmentSeedModule,
    LayoutTemplatesModule,
    WalletModule,
    VisitsModule,
    QrCampaignsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: DemoGuard },
  ],
})
export class AppModule {}
