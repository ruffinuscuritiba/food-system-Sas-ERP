/**
 * seed-whatsapp-settings.ts
 *
 * Upserts WhatsappAiSettings for every active WhatsappConnection that has none.
 *
 * Usage:
 *   npm run seed:wa
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    const connections = await prisma.whatsappConnection.findMany({
      where: { isActive: true },
      include: { settings: true },
    });

    console.log(`Found ${connections.length} active connection(s).`);

    let created = 0;
    let skipped = 0;

    for (const conn of connections) {
      if (conn.settings) {
        console.log(
          `  [SKIP] connectionId=${conn.id} (${conn.name ?? conn.instanceName ?? conn.id}) — settings already exist (isActive=${conn.settings.isActive}, mode=${conn.settings.mode}, aiProvider=${conn.settings.aiProvider})`,
        );
        skipped++;
        continue;
      }

      await prisma.whatsappAiSettings.upsert({
        where: { connectionId: conn.id },
        create: {
          connectionId: conn.id,
          companyId: conn.companyId,
          isActive: true,
          mode: 'AUTO',
          aiProvider: 'CLAUDE',
          attendantName: 'Carol',
          businessHoursStart: '08:00',
          businessHoursEnd: '23:00',
          businessDays: '0,1,2,3,4,5,6',
          useEmojis: true,
        },
        update: {
          isActive: true,
          mode: 'AUTO',
          aiProvider: 'CLAUDE',
          attendantName: 'Carol',
          businessHoursStart: '08:00',
          businessHoursEnd: '23:00',
          businessDays: '0,1,2,3,4,5,6',
          useEmojis: true,
        },
      });

      console.log(
        `  [CREATED] connectionId=${conn.id} (${conn.name ?? conn.instanceName ?? conn.id}) — settings seeded`,
      );
      created++;
    }

    console.log(`\nDone. Created: ${created}, Skipped (already existed): ${skipped}.`);
    if (created === 0 && skipped === 0) {
      console.log('No active connections found. Create a connection first via the admin panel.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
