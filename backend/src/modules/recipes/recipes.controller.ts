import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { RecipesService } from './recipes.service';

@Controller('recipes')
export class RecipesController {

  constructor(
    private readonly recipesService: RecipesService,
  ) {}

  @Get(':productId')
  findByProduct(
    @Param('productId')
    productId: string,
  ) {
    return this.recipesService.findByProduct(
      productId,
    );
  }

  @Post()
  create(
    @Body() body: any,
  ) {
    return this.recipesService.create(
      body,
    );
  }
}