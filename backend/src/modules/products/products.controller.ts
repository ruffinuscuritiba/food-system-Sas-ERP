import {
  Body,
  Controller,
  Get,
  Param,
  Post,
Delete,
Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";

import { ConfigService }
from "@nestjs/config";

import { FileInterceptor }
from "@nestjs/platform-express";

import { diskStorage }
from "multer";

import { extname }
from "path";

import { ProductsService }
from "./products.service";

import { JwtAuthGuard }
from "@/common/guards/jwt-auth.guard";

import { RolesGuard }
from "@/common/guards/roles.guard";

import { Roles }
from "@/common/decorators/roles.decorator";

import { CreateProductDto }
from "./dto/create-product.dto";

@Controller("products")
export class ProductsController {

  constructor(
    private readonly service: ProductsService,

    private readonly configService: ConfigService,
  ) {}

  @Get()

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )

  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
  )

  findAll() {

    return this.service.findAll();
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

  @UseInterceptors(
    FileInterceptor(
      "image",
      {
        storage:
          diskStorage({
            destination:
              "./uploads",

            filename: (
              req,
              file,
              callback,
            ) => {

              const uniqueName =
                Date.now() +
                extname(
                  file.originalname,
                );

              callback(
                null,
                uniqueName,
              );
            },
          }),
      },
    ),
  )

  create(
    @UploadedFile()
    file: Express.Multer.File,

    @Body()
    body: CreateProductDto,
  ) {

    const backendUrl =
      this.configService.get<string>(
        "BACKEND_URL",
      );

    return this.service.create({

      ...body,

      imageUrl: file
        ? `${backendUrl}/uploads/${file.filename}`
        : null,
    });
  }

  @Get(
    "public/menu/:companyId",
  )

  publicMenu(
    @Param("companyId")
    companyId: string,
  ) {

    return this.service.publicMenu(
      companyId,
    );
  }
  @Get("trash")

@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)

@Roles(
  "SUPER_ADMIN",
  "ADMIN",
)

findTrash() {

  return this.service.findTrash();
}

@Patch("restore/:id")

@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)

@Roles(
  "SUPER_ADMIN",
  "ADMIN",
)

restore(
  @Param("id")
  id: string,
) {

  return this.service.restore(
    id,
  );
}

  @Delete(":id")

@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)

@Roles(
  "SUPER_ADMIN",
  "ADMIN",
)

remove(
  @Param("id")
  id: string,
) {

  return this.service.remove(
    id,
  );
}
}