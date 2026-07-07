import {
  Controller,
  ForbiddenException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { isMatrixCompany } from '@/common/utils/matrix';
import { UpdateNoticesService } from './update-notices.service';

@Controller('update-notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UpdateNoticesController {
  constructor(private readonly service: UpdateNoticesService) {}

  /**
   * Disparo manual do aviso de atualização (super-admin ou empresa matriz).
   * Não respeita o limite diário — o clique é intenção explícita do operador.
   */
  @Post('broadcast')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async broadcast(@Request() req: any) {
    if (
      req.user.role !== 'SUPER_ADMIN' &&
      !isMatrixCompany(req.user.companyId)
    ) {
      throw new ForbiddenException(
        'Apenas a empresa matriz pode disparar avisos de atualização',
      );
    }
    return this.service.broadcast();
  }
}
