import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const BIZBUYSELL_DUMMIES = [
    {
        title: 'Highly Profitable B2B SaaS in the HR Tech Space',
        description: 'This is a well-established SaaS business providing human resources management software for mid-sized companies. It boasts a 95% retention rate and consistent year-over-year growth.',
        industryNormalized: 'Technology & SaaS',
        askingPrice: BigInt(250000000), // $2.5M
        revenue: BigInt(80000000), // $800k
        cashFlow: BigInt(65000000), // $650k
        city: 'Austin',
        stateCode: 'TX',
        brokerName: 'John Smith'
    },
    {
        title: 'Popular Downtown Coffee Shop & Roastery',
        description: 'Turn-key coffee shop with an established local following. Includes all roasting equipment and a long-term lease in a high-traffic area.',
        industryNormalized: 'Restaurants & Food',
        askingPrice: BigInt(45000000), // $450k
        revenue: BigInt(60000000),
        cashFlow: BigInt(15000000),
        city: 'Seattle',
        stateCode: 'WA',
        brokerName: 'Jane Doe'
    },
    {
        title: 'Commercial HVAC Service Business',
        description: 'Provider of commercial HVAC installation and maintenance services with multiple long-term contracts. Fleet of 5 fully equipped vans included.',
        industryNormalized: 'Construction',
        askingPrice: BigInt(120000000), // $1.2M
        revenue: BigInt(210000000),
        cashFlow: BigInt(40000000),
        city: 'Phoenix',
        stateCode: 'AZ',
        brokerName: 'Bob Williams'
    }
];

const BIZQUEST_DUMMIES = [
    {
        title: 'E-commerce Brand: Specialized Outdoor Gear',
        description: 'Direct-to-consumer brand selling proprietary outdoor equipment. High margins and low return rate. Automated fulfillment center in place.',
        industryNormalized: 'E-commerce',
        askingPrice: BigInt(85000000), // $850k
        revenue: BigInt(140000000),
        cashFlow: BigInt(35000000),
        city: 'Denver',
        stateCode: 'CO',
        brokerName: 'Alice Johnson'
    },
    {
        title: 'Boutique Fitness Studio / Gym Franchise',
        description: 'Profitable fitness studio located in a rapidly growing suburban area. Strong recurring membership base and minimal owner involvement required.',
        industryNormalized: 'Entertainment & Recreation',
        askingPrice: BigInt(50000000), // $500k
        revenue: BigInt(75000000),
        cashFlow: BigInt(18000000),
        city: 'Atlanta',
        stateCode: 'GA',
        brokerName: 'Mike Davis'
    }
];

const ACQUIRE_DUMMIES = [
    {
        title: 'AI-Powered Content Generation Tool',
        description: 'Micro-SaaS utilizing advanced LLMs to generate marketing copy. Zero customer acquisition cost (100% organic traffic) and >90% gross margins.',
        industryNormalized: 'Technology & SaaS',
        askingPrice: BigInt(150000000), // $1.5M
        revenue: BigInt(30000000),
        cashFlow: BigInt(28000000),
        city: 'San Francisco',
        stateCode: 'CA',
        brokerName: 'Acquire Team'
    },
    {
        title: 'Shopify App for Inventory Expansion',
        description: 'Top-rated Shopify application that helps dropshippers sync inventory. Solid MRR with exceptionally low churn. Huge potential for feature expansion.',
        industryNormalized: 'Technology & SaaS',
        askingPrice: BigInt(95000000), // $950k
        revenue: BigInt(25000000),
        cashFlow: BigInt(22000000),
        city: 'New York',
        stateCode: 'NY',
        brokerName: 'Acquire Team'
    }
];

function generateDedupeHash(parts: string[]): string {
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

async function main() {
    console.log('Fetching sources...');
    const bizBuySellSource = await prisma.source.findUnique({ where: { name: 'bizbuysell' } });
    const bizQuestSource = await prisma.source.findUnique({ where: { name: 'bizquest' } });
    const acquireSource = await prisma.source.findUnique({ where: { name: 'acquire' } });

    if (!bizBuySellSource || !bizQuestSource || !acquireSource) {
        throw new Error('Sources missing in DB! Please run npm run db:setup first.');
    }

    const dataMap = [
        { source: bizBuySellSource, data: BIZBUYSELL_DUMMIES },
        { source: bizQuestSource, data: BIZQUEST_DUMMIES },
        { source: acquireSource, data: ACQUIRE_DUMMIES },
    ];

    let totalInserted = 0;

    for (const { source, data } of dataMap) {
        console.log(`\nInserting dummy data for ${source.name}...`);

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const sourceListingId = `dummy-${source.name}-${i}`;

            const hashParts = [
                item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50),
                item.askingPrice.toString(),
                item.stateCode || '',
                item.city?.toLowerCase().replace(/[^a-z]/g, '').slice(0, 20) || ''
            ];

            try {
                await prisma.listing.create({
                    data: {
                        sourceId: source.id,
                        sourceListingId: sourceListingId,
                        sourceUrl: `${source.baseUrl}/dummy-listing-${i}`,
                        title: item.title,
                        description: item.description,
                        descriptionClean: item.description,
                        industryNormalized: item.industryNormalized,
                        askingPrice: item.askingPrice,
                        revenue: item.revenue,
                        cashFlow: item.cashFlow,
                        multiple: Number(item.askingPrice) / Number(item.cashFlow),
                        city: item.city,
                        stateCode: item.stateCode,
                        brokerName: item.brokerName,
                        dedupeHash: generateDedupeHash(hashParts),
                        status: 'ACTIVE'
                    }
                });
                totalInserted++;
            } catch (err) {
                console.error(`Error inserting ${item.title}:`, err);
            }
        }
    }

    console.log(`\nSuccessfully inserted ${totalInserted} dummy listings!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
