import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";

import { JwtService }
from "@nestjs/jwt";

import * as bcrypt
from "bcrypt";

import { PrismaService }
from "@/database/prisma.service";

import { LoginDto }
from "./dto/login.dto";

import { RegisterDto }
from "./dto/register.dto";

import { AuditService }
from "@/modules/audit/audit.service";

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,

    private readonly jwtService: JwtService,

    private readonly auditService: AuditService,
  ) {}

  async register(
    dto: RegisterDto,
  ) {

    const userExists =
      await this.prisma.user.findUnique({

        where: {
          email: dto.email,
        },
      });

    if (userExists) {

      throw new BadRequestException(
        "Email já cadastrado",
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        dto.password,
        10,
      );

    const user =
      await this.prisma.user.create({

        data: {

          name:
            dto.name,

          email:
            dto.email,

          password:
            hashedPassword,

          role:
            dto.role,

          companyId:
            dto.companyId,
        },
      });

    await this.auditService.log({

      action:
        "REGISTER",

      entity:
        "User",

      entityId:
        user.id,

      description:
        `Usuário criado: ${user.email}`,

      userId:
        user.id,

      companyId:
        user.companyId,

      metadata: {

        email:
          user.email,

        role:
          user.role,
      },
    });

    const {
      password,
      ...userWithoutPassword
    } = user;

    return userWithoutPassword;
  }

  async login(
    dto: LoginDto,
  ) {

    const user =
      await this.prisma.user.findUnique({

        where: {
          email: dto.email,
        },

        include: {
          company: true,
        },
      });

    if (!user) {

      throw new UnauthorizedException(
        "Usuário não encontrado",
      );
    }

    const passwordMatch =
      await bcrypt.compare(
        dto.password,
        user.password,
      );

    if (
      user.company?.isBlocked
    ) {

      throw new UnauthorizedException(
        "Empresa bloqueada",
      );
    }

    if (!passwordMatch) {

      throw new UnauthorizedException(
        "Senha inválida",
      );
    }

    const accessToken =
      await this.jwtService.signAsync({

        sub:
          user.id,

        email:
          user.email,

        companyId:
          user.companyId,

        role:
          user.role,
      });

    await this.auditService.log({

      action:
        "LOGIN",

      entity:
        "User",

      entityId:
        user.id,

      description:
        `Login realizado por ${user.email}`,

      userId:
        user.id,

      companyId:
        user.companyId,

      metadata: {

        email:
          user.email,

        role:
          user.role,
      },
    });

    const {
      password,
      ...userWithoutPassword
    } = user;

    return {

      accessToken,

      user: {

        ...userWithoutPassword,

        company:
          user.company,
      },
    };
  }
}