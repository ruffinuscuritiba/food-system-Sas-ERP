import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SmartImportService } from './smart-import.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('smart-import')
export class SmartImportController {
  constructor(private service: SmartImportService) {}

  /** Upload menu image → start async processing */
  @Post('menu')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadMenu(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const companyId: string = req.user.companyId;
    return this.service.processMenuImage(
      file.buffer,
      file.mimetype,
      companyId,
      undefined,
      file.originalname,
    );
  }

  /** Upload invoice (image/PDF/XML) → start async processing */
  @Post('invoice')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadInvoice(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const companyId: string = req.user.companyId;
    return this.service.processInvoice(file.buffer, file.mimetype, companyId);
  }

  /** Poll processing status + results */
  @Get('session/:id')
  getSession(@Param('id') id: string, @Request() req: any) {
    return this.service.getSession(id, req.user.companyId);
  }

  /** List recent import sessions */
  @Get('sessions')
  listSessions(@Request() req: any) {
    return this.service.listSessions(req.user.companyId);
  }

  /** Confirm and save menu items as products */
  @Post('confirm/menu/:sessionId')
  confirmMenu(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      items: Array<{
        itemId: string;
        name: string;
        description?: string;
        price?: number;
        categoryId?: string;
      }>;
    },
    @Request() req: any,
  ) {
    return this.service.confirmMenuItems(
      sessionId,
      body.items,
      req.user.companyId,
    );
  }

  /** Confirm and save invoice items as stock entries */
  @Post('confirm/invoice/:sessionId')
  confirmInvoice(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      items: Array<{
        itemId: string;
        name: string;
        quantity: number;
        unitCost: number;
        unit?: string;
        createProduct?: boolean;
      }>;
    },
    @Request() req: any,
  ) {
    return this.service.confirmInvoiceItems(
      sessionId,
      body.items,
      req.user.companyId,
    );
  }
}
