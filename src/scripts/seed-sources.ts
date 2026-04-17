import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sources = [
        { name: 'bizbuysell', baseUrl: 'https://www.bizbuysell.com', scrapeFrequencyMinutes: 360 },
        { name: 'bizquest', baseUrl: 'https://www.bizquest.com', scrapeFrequencyMinutes: 360 },
        { name: 'acquire', baseUrl: 'https://acquire.com', scrapeFrequencyMinutes: 720 },
        { name: 'transworld', baseUrl: 'https://www.tworld.com', scrapeFrequencyMinutes: 1440 },
        { name: 'quietlight', baseUrl: 'https://quietlight.com', scrapeFrequencyMinutes: 1440 },
    ];

    for (const source of sources) {
        await prisma.source.upsert({
            where: { name: source.name },
            update: source,
            create: source,
        });
        console.log(`✓ Seeded source: ${source.name}`);
    }

    console.log('\nAll sources seeded successfully!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
