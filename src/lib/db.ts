import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma in Next.js
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Serialize BigInt for JSON (financial amounts stored in cents → dollars)
export function serializeListing(l: any): any {
    return {
        ...l,
        askingPrice: l.askingPrice != null ? Number(l.askingPrice) / 100 : null,
        revenue: l.revenue != null ? Number(l.revenue) / 100 : null,
        cashFlow: l.cashFlow != null ? Number(l.cashFlow) / 100 : null,
        previousPrice: l.previousPrice != null ? Number(l.previousPrice) / 100 : null,
        inventory: l.inventory != null ? Number(l.inventory) / 100 : null,
        ffe: l.ffe != null ? Number(l.ffe) / 100 : null,
        realEstate: l.realEstate != null ? Number(l.realEstate) / 100 : null,
    };
}

export function serializeListings(listings: any[]): any[] {
    return listings.map(serializeListing);
}
