import {
  Body,
  Controller,
  Get,
  Param,
  Post,
Delete,
Patch,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";

import { ConfigService }
from "@nestjs/config";

import { FileInterceptor }
from "@nestjs/platform-express";

import { memoryStorage }
from "multer";

import { extname, join }
from "path";

import { writeFileSync, mkdirSync }
from "fs";

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

  findAll(
    @Request() req: any,
  ) {

    return this.service.findAll(req.user.companyId);
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
    FileInterceptor("image", { storage: memoryStorage() }),
  )

  async create(
    @UploadedFile()
    file: Express.Multer.File,

    @Body()
    body: CreateProductDto,
  ) {
    let imageUrl: string | null = body.imageUrl || null;

    if (file) {
      const cloudinaryUrl = this.configService.get<string>("CLOUDINARY_URL");

      if (cloudinaryUrl) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const cloudinary = require("cloudinary").v2;
          cloudinary.config({ cloudinary_url: cloudinaryUrl });

          const result = await new Promise<any>((resolve, reject) => {
            const { Readable } = require("stream");
            const stream = cloudinary.uploader.upload_stream(
              { folder: "food-system", resource_type: "image" },
              (error: any, result: any) => {
                if (error) reject(error);
                else resolve(result);
              },
            );
            Readable.from(file.buffer).pipe(stream);
          });

          imageUrl = result.secure_url;
        } catch {
          // fallback to local
        }
      }

      if (!imageUrl) {
        const uploadsDir = join(process.cwd(), "uploads");
        try { mkdirSync(uploadsDir, { recursive: true }); } catch { /* ok */ }
        const filename = `${Date.now()}${extname(file.originalname)}`;
        writeFileSync(join(uploadsDir, filename), file.buffer);
        const backendUrl =
          this.configService.get<string>("BACKEND_URL") ||
          `http://localhost:${process.env.PORT || 3001}`;
        imageUrl = `${backendUrl}/uploads/${filename}`;
      }
    }

    return this.service.create({ ...body, imageUrl });
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