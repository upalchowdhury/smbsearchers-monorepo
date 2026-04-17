import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sources = await prisma.source.findMany({
    include: {
      _count: {
        select: { listings: true }
      }
    }
  });

  console.log("=== Sources and Listing Counts ===");
  if (sources.length === 0) {
    console.log("No sources found in the DB. The DB might be empty.");
  } else {
    for (const source of sources) {
      console.log(`- ${source.name}: ${source._count.listings} listings`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
