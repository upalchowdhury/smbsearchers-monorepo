import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/admin/stats — Dashboard overview stats
export async function GET(request: NextRequest) {
    try {
        const [totalActive, totalAll, bySource, byIndustry, byState, recentRuns] = await Promise.all([
            prisma.listing.count({ where: { status: 'ACTIVE', canonicalId: null } }),
            prisma.listing.count(),
            prisma.$queryRaw<{ name: string; count: number }[]>`
        SELECT s."name", COUNT(l."id")::int as count
        FROM "Listing" l JOIN "Source" s ON l."sourceId" = s."id"
        WHERE l."status" = 'ACTIVE' AND l."canonicalId" IS NULL
        GROUP BY s."name" ORDER BY count DESC
      `,
            prisma.$queryRaw<{ industryNormalized: string; count: number }[]>`
        SELECT "industryNormalized", COUNT(*)::int as count
        FROM "Listing"
        WHERE "status" = 'ACTIVE' AND "canonicalId" IS NULL AND "industryNormalized" IS NOT NULL
        GROUP BY "industryNormalized" ORDER BY count DESC LIMIT 20
      `,
            prisma.$queryRaw<{ stateCode: string; count: number }[]>`
        SELECT "stateCode", COUNT(*)::int as count
        FROM "Listing"
        WHERE "status" = 'ACTIVE' AND "canonicalId" IS NULL AND "stateCode" IS NOT NULL
        GROUP BY "stateCode" ORDER BY count DESC LIMIT 10
      `,
            prisma.scrapeRun.findMany({
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: { source: { select: { name: true } } },
            }),
        ]);

        return NextResponse.json({
            totalActive,
            totalAll,
            bySource,
            byIndustry,
            byState,
            recentRuns,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
