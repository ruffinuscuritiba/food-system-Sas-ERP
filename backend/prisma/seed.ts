import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const DEFAULT_MODULES = ['TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY']

async function seedCompanyWithModules(
  id: string,
  name: string,
  email: string,
  plan: string,
  password: string,
  role: 'SUPER_ADMIN' | 'ADMIN',
) {
  const company = await prisma.company.upsert({
    where: { id },
    update: {},
    create: { id, name, email, plan, subscriptionStatus: 'ACTIVE', isBlocked: false },
  })

  const hashedPassword = await bcrypt.hash(password, 10)
  await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, role, isActive: true },
    create: { name: `Admin ${name}`, email, password: hashedPassword, role, isActive: true, companyId: company.id },
  })

  for (const mod of DEFAULT_MODULES) {
    await prisma.companyModule.upsert({
      where: { id: `module-${mod.toLowerCase()}-${id}` },
      update: { active: true },
      create: { id: `module-${mod.toLowerCase()}-${id}`, module: mod, active: true, companyId: company.id },
    })
  }

  return company
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Empresa 1 — seed principal (SUPER_ADMIN)
  const c1 = await seedCompanyWithModules(
    'company-seed-001',
    'Ruffinus Food System',
    'admin@teste.com',
    'ENTERPRISE',
    '123456',
    'SUPER_ADMIN',
  )
  console.log(`✅ ${c1.name} — admin@teste.com / 123456`)

  // Empresa 2 — restaurante de teste A
  const c2 = await seedCompanyWithModules(
    'company-seed-002',
    'Pizzaria Bella Napoli',
    'admin@bellanapoli.com',
    'PROFESSIONAL',
    '123456',
    'ADMIN',
  )
  console.log(`✅ ${c2.name} — admin@bellanapoli.com / 123456`)

  // Empresa 3 — restaurante de teste B
  const c3 = await seedCompanyWithModules(
    'company-seed-003',
    'Burger Fusion',
    'admin@burgerfusion.com',
    'BASIC',
    '123456',
    'ADMIN',
  )
  console.log(`✅ ${c3.name} — admin@burgerfusion.com / 123456`)

  console.log('\n🎉 Seed concluído!')
  console.log('\n📋 Super Admin do sistema:')
  console.log('   URL:   /super-admin/login')
  console.log('   Email: superadmin@system.com')
  console.log('   Senha: SuperAdmin@123')
  console.log('\n📋 Restaurantes de teste — senha: 123456')
  console.log('   admin@teste.com        (SUPER_ADMIN — Ruffinus)')
  console.log('   admin@bellanapoli.com  (ADMIN — Bella Napoli)')
  console.log('   admin@burgerfusion.com (ADMIN — Burger Fusion)')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
