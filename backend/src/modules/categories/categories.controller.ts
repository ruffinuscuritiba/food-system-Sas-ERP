import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CategoriesService }
from "./categories.service";

import { JwtAuthGuard }
from "@/common/guards/jwt-auth.guard";

import { RolesGuard }
from "@/common/guards/roles.guard";

import { Roles }
from "@/common/decorators/roles.decorator";

@Controller("categories")
export class CategoriesController {

  constructor(
    private service: CategoriesService,
  ) {}

  @Get(":companyId")

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )

  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
  )

  findAll(
    @Param("companyId")
    companyId: string,
  ) {

    return this.service.findAll(
      companyId,
    );
  }

  @Post()

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )

  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
  )

  create(
    @Body()
    body: any,
  ) {

    return this.service.create(
      body,
    );
  }
}