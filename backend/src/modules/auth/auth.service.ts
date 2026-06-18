import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuditService } from '@/modules/audit/audit.service';
import { LeadsService } from '@/modules/leads/leads.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { SegmentSeedService } from '@/modules/segment-seed/segment-seed.service';

const DEMO_PLAN_EMAIL: Record<string, string> = {
  basic:      'demo-basic@foodsaas.demo',
  pro:        'demo-pro@foodsaas.demo',
  enterprise: 'demo-enterprise@foodsaas.demo',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly leadsService: LeadsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly segmentSeed: SegmentSeedService,
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
    businessSegment?: string;
  }) {
    await this.assertEmailUnique(dto.email);

    // New companies start as PENDING_PAYMENT — 3-day free trial, no card required.
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 3);

    const segment = dto.businessSegment ?? 'RESTAURANTE';
    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        email: dto.email,
        plan: 'BASIC',
        subscriptionStatus: 'PENDING_PAYMENT',
        dueDate: trialEnds,
        isBlocked: false,
        businessSegment: segment,
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

    // Seed automático por segmento — fire-and-forget, não bloqueia o cadastro
    setImmediate(() => {
      this.segmentSeed.seedForCompany(company.id, segment).catch((err) =>
        this.logger.error(`[Signup] SegmentSeed failed for ${company.id}: ${err?.message}`),
      );
    });

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

  async demoAccess(dto: {
    name: string;
    email: string;
    whatsapp: string;
    restaurantName: string;
    plan: 'basic' | 'pro' | 'enterprise';
  }) {
    const demoEmail = DEMO_PLAN_EMAIL[dto.plan];
    if (!demoEmail) throw new BadRequestException('Plano de demonstração inválido');

    const sessionToken = `demo-gate-${dto.email}-${Date.now()}`;

    // 1. Save lead (fire-and-forget — never blocks demo access)
    setImmediate(async () => {
      try {
        await this.leadsService.upsert({
          sessionToken,
          name: dto.name,
          company: dto.restaurantName,
          whatsapp: dto.whatsapp,
          recommendedPlan: dto.plan.toUpperCase(),
        });
      } catch (err) {
        this.logger.warn(`Lead save failed: ${(err as Error)?.message}`);
      }
    });

    // 2. Notify admin (fire-and-forget)
    const adminEmail = this.config.get<string>('ADMIN_NOTIFY_EMAIL');
    if (adminEmail) {
      setImmediate(async () => {
        try {
          await this.notifications.send({
            to: adminEmail,
            type: 'DEMO_LEAD',
            data: {
              name:           dto.name,
              email:          dto.email,
              whatsapp:       dto.whatsapp,
              restaurantName: dto.restaurantName,
              plan:           dto.plan.toUpperCase(),
            },
          });
        } catch (err) {
          this.logger.warn(`Demo lead email failed: ${(err as Error)?.message}`);
        }
      });
    } else {
      this.logger.warn(
        `[DEMO LEAD] ADMIN_NOTIFY_EMAIL not set — lead data: ${JSON.stringify({ name: dto.name, restaurantName: dto.restaurantName, whatsapp: dto.whatsapp, plan: dto.plan })}`,
      );
    }

    // 3. Find demo user and return token
    const user = await this.prisma.user.findUnique({
      where: { email: demoEmail },
      include: { company: true },
    });

    if (!user) throw new BadRequestException('Conta de demonstração não disponível. Tente novamente em instantes.');

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return { accessToken, user: { ...userWithoutPassword, company: user.company } };
  }
}
