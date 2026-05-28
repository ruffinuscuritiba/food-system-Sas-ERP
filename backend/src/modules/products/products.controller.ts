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
    "CASHIER",
    "WAITER",
    "KITCHEN",
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
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateProductDto,
  ) {
    let imageUrl: string | null = body.imageUrl || null;

    if (file) {
      imageUrl = await this.resolveImageUrl(file);
    }

    // companyId always from JWT — never trust the body
    return this.service.create({ ...body, imageUrl, companyId: req.user.companyId });
  }

  @Patch(":id")

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

  async update(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    let imageUrl: string | undefined = body.imageUrl;

    if (file) {
      imageUrl = await this.resolveImageUrl(file);
    }

    return this.service.update(id, { ...body, ...(imageUrl !== undefined ? { imageUrl } : {}) });
  }

  /**
   * Convert a multer file to a persistent URL.
   * Priority: Cloudinary → base64 data URL (stored in DB, zero infra needed).
   * Local-disk fallback removed: Render's filesystem is ephemeral.
   */
  private async resolveImageUrl(file: Express.Multer.File): Promise<string> {
    const cloudinaryUrl = this.configService.get<string>("CLOUDINARY_URL");

    if (cloudinaryUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const cloudinary = require("cloudinary").v2;
        cloudinary.config({ cloudinary_url: cloudinaryUrl });
        const result = await new Promise<any>((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { Readable } = require("stream");
          const stream = cloudinary.uploader.upload_stream(
            { folder: "food-system", resource_type: "image" },
            (error: any, res: any) => { if (error) reject(error); else resolve(res); },
          );
          Readable.from(file.buffer).pipe(stream);
        });
        return result.secure_url;
      } catch {
        // fall through to base64
      }
    }

    // Fallback: base64 data URL — permanent (stored in DB), no external service needed
    const mime = file.mimetype?.startsWith("image/") ? file.mimetype : "image/jpeg";
    return `data:${mime};base64,${file.buffer.toString("base64")}`;
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