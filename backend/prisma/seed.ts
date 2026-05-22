import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Criar empresa padrão
  const company = await prisma.company.upsert({
    where: { id: 'company-seed-001' },
    update: {},
    create: {
      id: 'company-seed-001',
      name: 'Ruffinus Food System',
      description: 'Empresa padrão criada pelo seed',
      email: 'contato@ruffinus.com',
      phone: '(41) 99999-9999',
      plan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      isBlocked: false,
    },
  })

  console.log(`✅ Empresa criada: ${company.name} (${company.id})`)

  // Hash da senha padrão
  const hashedPassword = await bcrypt.hash('123456', 10)

  // Criar usuário admin padrão
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@teste.com' },
    update: {
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      name: 'Admin Padrão',
      email: 'admin@teste.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      companyId: company.id,
    },
  })

  console.log(`✅ Usuário admin criado: ${adminUser.email} (role: ${adminUser.role})`)
  console.log(`   Senha em texto plano: 123456`)

  // Criar segundo usuário admin como fallback
  const adminUser2 = await prisma.user.upsert({
    where: { email: 'admin@food.com' },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      name: 'Admin Food',
      email: 'admin@food.com',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      companyId: company.id,
    },
  })

  console.log(`✅ Usuário admin2 criado: ${adminUser2.email} (role: ${adminUser2.role})`)

  console.log('\n🎉 Seed concluído com sucesso!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('   Email: admin@teste.com')
  console.log('   Senha: 123456')
  console.log('   Role:  SUPER_ADMIN')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
