import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  getBalance(@CompanyId() companyId: string) {
    return this.walletService.getBalance(companyId).then((balance) => ({ balance }));
  }

  @Get('transactions')
  getTransactions(@CompanyId() companyId: string) {
    return this.walletService.getTransactions(companyId);
  }

  @Get('repasses')
  getRepasses(@CompanyId() companyId: string) {
    return this.walletService.getRepasses(companyId);
  }
}
