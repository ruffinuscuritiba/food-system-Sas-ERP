import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  private async assertEmailUnique(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email já cadastrado');
  }

  async signup(dto: {
    companyName: string;
    name: string;
    email: string;
    password: string;
  }) {
    await this.assertEmailUnique(dto.email);

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        email: dto.email,
        plan: 'BASIC',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    });

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: 'ADMIN',
        isActive: true,
        companyId: company.id,
      },
    });

    for (const mod of [
      'TABLES',
      'CASH',
      'FINANCIAL',
      'STOCK',
      'RECIPES',
    ]) {
      await this.prisma.companyModule.create({
        data: { module: mod, active: true, companyId: company.id },
      });
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return { accessToken, user: { ...userWithoutPassword, company } };
  }

  async register(dto: RegisterDto) {
    await this.assertEmailUnique(dto.email);

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        companyId: dto.companyId,
      },
    });

    await this.auditService.log({
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
      description: `Usuário criado: ${user.email}`,
      userId: user.id,
      companyId: user.companyId,
      metadata: { email: user.email, role: user.role },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { company: true },
    });

    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    if (user.company?.isBlocked)
      throw new UnauthorizedException('Empresa bloqueada');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Senha inválida');

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    });

    await this.auditService.log({
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      description: `Login realizado por ${user.email}`,
      userId: user.id,
      companyId: user.companyId,
      metadata: { email: user.email, role: user.role },
    });

    const { password: _, ...userWithoutPassword } = user;
    return {
      accessToken,
      user: { ...userWithoutPassword, company: user.company },
    };
  }
}
