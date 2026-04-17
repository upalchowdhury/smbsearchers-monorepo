import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateDedupeHash(parts: string[]): string {
    return crypto.createHash('sha256').update(parts.join('|').toLowerCase()).digest('hex');
}

const listingsData = {
    bizbuysell: [
        {
            title: "Downtown Boutique with Events, Online Store & 30K Customer List",
            description: "Step into ownership of a truly unique retail concept in the heart of Columbia’s vibrant downtown district. The Edgy Cowgirl is more than just a boutique — it’s a destination shopping experience that includes a highly curated retail space, a vibrant events business, and a robust online storefront.",
            askingPrice: 4800000, // $48k in cents
            cashFlow: 1487600,
            revenue: 12636300,
            industryNormalized: "Clothing and Accessory Stores",
            city: "Columbia",
            stateCode: "MO",
            brokerName: "Kelly Franko"
        },
        {
            title: "Auto Repair shop with RE, 6 bays in Prime Location",
            description: "This established and profitable six-bay auto repair business is located in a high-traffic and densely populated area of the Twin Cities with prime commercial real estate. With over 22 years of history, it has built a loyal customer base and a reputation for excellence.",
            askingPrice: 25000000, // in cents
            cashFlow: 20000000,
            revenue: 68846500,
            industryNormalized: "Auto Repair",
            city: "Minneapolis",
            stateCode: "MN",
            brokerName: "Mac Thelen"
        },
        {
            title: "Profitable Moving & Storage Company w/ Long-Term Client Contracts",
            description: "Established moving and storage company with a strong reputation and long-term client contracts. The business operates with efficient systems and has multiple revenue streams within the service industry.",
            askingPrice: 115000000, // cents
            cashFlow: 53914600,
            revenue: 262360900,
            industryNormalized: "Moving & Storage",
            city: "Santa Rosa",
            stateCode: "CA",
            brokerName: "Cynthia Randall"
        }
    ],
    bizquest: [
        {
            title: "Downtown Boutique with Events, Online Store & 30K Customer List (BizQuest)",
            description: "Turnkey Destination Boutique with Loyal Customers & Growth Potential",
            askingPrice: 4800000,
            cashFlow: 0,
            revenue: 0,
            industryNormalized: "Retail",
            city: "Columbia",
            stateCode: "MO",
            brokerName: "Contact Broker"
        },
        {
            title: "Grocery Store + Plaza | $45K Inside Sales | 20k Coam- Jonesboro GA",
            description: "Coam 20k 1 side- Contract End December 2026",
            askingPrice: 180000000,
            cashFlow: 0,
            revenue: 54000000,
            industryNormalized: "Retail",
            city: "Jonesboro",
            stateCode: "GA",
            brokerName: "Contact Broker"
        },
        {
            title: "Very Profitable Lite Fitness Products Online Business",
            description: "High Demand Low Touch High Demand Business-$500K+ 2025 revenues",
            askingPrice: 8000000,
            cashFlow: 0,
            revenue: 50000000,
            industryNormalized: "Ecommerce",
            city: "Los Angeles County",
            stateCode: "CA",
            brokerName: "Contact Broker"
        }
    ],
    acquire: [
        {
            title: "Connecting pre-health students to expert consultants and resources for application success.",
            description: "Marketplace startup in the United States",
            askingPrice: 35000000,
            cashFlow: 8974400,
            revenue: 0,
            industryNormalized: "SaaS",
            city: "",
            stateCode: "",
            brokerName: "Acquire"
        },
        {
            title: "A secure marketplace that helps people easily buy and sell verified social media accounts",
            description: "Marketplace startup in the United Kingdom",
            askingPrice: 9900000,
            cashFlow: 4500000,
            revenue: 0,
            industryNormalized: "SaaS",
            city: "",
            stateCode: "",
            brokerName: "Acquire"
        },
        {
            title: "Latin American-based marketplace for consumers to rent film equipment and book event locations",
            description: "Marketplace startup in Mexico",
            askingPrice: 54000000,
            cashFlow: 18000000,
            revenue: 0,
            industryNormalized: "Marketplace",
            city: "",
            stateCode: "",
            brokerName: "Acquire"
        }
    ]
};

async function main() {
    console.log('Fetching sources...');
    const sources = await prisma.source.findMany();
    const sourceMap = new Map(sources.map(s => [s.name, s]));

    let totalInserted = 0;

    for (const [sourceName, items] of Object.entries(listingsData)) {
        const source = sourceMap.get(sourceName);
        if (!source) {
            console.log(`Source ${sourceName} not found in DB, skipping...`);
            continue;
        }

        console.log(`\nInserting actual scraped data for ${sourceName}...`);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const sourceListingId = `actual-listing-${i}`;

            // Generate dedupe hash
            const hashParts = [
                source.id.toString(),
                item.title?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || '',
                item.askingPrice?.toString() || '',
                item.city?.toLowerCase().replace(/[^a-z]/g, '').slice(0, 20) || ''
            ];

            try {
                await prisma.listing.create({
                    data: {
                        sourceId: source.id,
                        sourceListingId: sourceListingId,
                        sourceUrl: `${source.baseUrl}/actual-listing-${i}`,
                        title: item.title,
                        description: item.description,
                        descriptionClean: item.description,
                        industryNormalized: item.industryNormalized,
                        askingPrice: BigInt(item.askingPrice),
                        revenue: item.revenue ? BigInt(item.revenue) : null,
                        cashFlow: item.cashFlow ? BigInt(item.cashFlow) : null,
                        multiple: (item.askingPrice && item.cashFlow) ? Number(item.askingPrice) / Number(item.cashFlow) : null,
                        city: item.city || null,
                        stateCode: item.stateCode || null,
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

    console.log(`\nSuccessfully inserted ${totalInserted} actual listings from 3 sites!`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
