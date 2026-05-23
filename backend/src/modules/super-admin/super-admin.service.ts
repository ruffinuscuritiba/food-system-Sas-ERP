import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '@/database/prisma.service'

const SA_EMAIL = 'superadmin@system.com'
const SA_PASSWORD = 'SuperAdmin@123'
const DEFAULT_MODULES = ['TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY']

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    if (email !== SA_EMAIL || password !== SA_PASSWORD) {
      throw new UnauthorizedException('Credenciais inválidas')
    }
    const accessToken = await this.jwtService.signAsync(
      { email, role: 'SYSTEM_SUPER_ADMIN' },
      {
        secret: this.configService.get<string>('JWT_SECRET') || 'secret',
        expiresIn: '8h',
      },
    )
    return { accessToken, email }
  }

  async listCompanies() {
    return this.prisma.company.findMany({
      include: {
        modules: true,
        _count: { select: { users: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createCompany(data: {
    name: string
    email: string
    adminPassword: string
    plan?: string
    phone?: string
  }) {
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10)

    const company = await this.prisma.company.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        plan: data.plan || 'BASIC',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    })

    await this.prisma.user.create({
      data: {
        name: `Admin ${data.name}`,
        email: data.email,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        companyId: company.id,
      },
    })

    await Promise.all(
      DEFAULT_MODULES.map((mod) =>
        this.prisma.companyModule.create({
          data: { module: mod, active: true, companyId: company.id },
        }),
      ),
    )

    return company
  }

  async toggleBlock(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Empresa não encontrada')
    return this.prisma.company.update({
      where: { id },
      data: { isBlocked: !company.isBlocked },
    })
  }

  async impersonateCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new NotFoundException('Empresa não encontrada')

    const adminUser = await this.prisma.user.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!adminUser) throw new NotFoundException('Nenhum usuário ativo nesta empresa')

    const accessToken = await this.jwtService.signAsync(
      { sub: adminUser.id, email: adminUser.email, companyId: adminUser.companyId, role: adminUser.role },
      { secret: this.configService.get<string>('JWT_SECRET') || 'secret', expiresIn: '4h' },
    )

    return {
      accessToken,
      companyName: company.name,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        companyId: adminUser.companyId,
      },
    }
  }

  async deleteCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Empresa não encontrada')
    await this.prisma.companyModule.deleteMany({ where: { companyId: id } })
    await this.prisma.user.deleteMany({ where: { companyId: id } })
    return this.prisma.company.delete({ where: { id } })
  }

  async getStats() {
    const [total, active, blocked] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { isBlocked: false, subscriptionStatus: 'ACTIVE' } }),
      this.prisma.company.count({ where: { isBlocked: true } }),
    ])
    return { total, active, blocked }
  }
}
