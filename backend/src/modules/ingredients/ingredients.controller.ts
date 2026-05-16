import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { IngredientsService } from './ingredients.service';

@Controller('ingredients')
export class IngredientsController {

  constructor(
    private readonly ingredientsService: IngredientsService,
  ) {}

  @Get(':companyId')
  findAll(
    @Param('companyId')
    companyId: string,
  ) {
    return this.ingredientsService.findAll(
      companyId,
    );
  }

  @Post()
  create(
    @Body() body: any,
  ) {
    return this.ingredientsService.create(
      body,
    );
  }
}