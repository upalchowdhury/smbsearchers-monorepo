import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function deduplicateListings(): Promise<{ merged: number }> {
    let merged = 0;

    // Step 1: Exact hash duplicates (same title+price+state+city)
    const hashDupes = await prisma.$queryRaw<{ dedupeHash: string; ids: string[] }[]>`
    SELECT "dedupeHash", array_agg("id" ORDER BY "firstSeenAt" ASC) as ids
    FROM "Listing"
    WHERE "canonicalId" IS NULL
      AND "status" = 'ACTIVE'
      AND "dedupeHash" IS NOT NULL
    GROUP BY "dedupeHash"
    HAVING COUNT(*) > 1
  `;

    for (const group of hashDupes) {
        const [canonical, ...dupes] = group.ids;
        if (dupes.length > 0) {
            await prisma.listing.updateMany({
                where: { id: { in: dupes } },
                data: { canonicalId: canonical },
            });
            merged += dupes.length;
        }
    }

    console.log(`[dedup] Exact hash merges: ${merged}`);

    // Step 2: Fuzzy title match within same state + similar price (±10%)
    try {
        const fuzzyDupes = await prisma.$queryRaw<{ id1: string; id2: string; similarity: number }[]>`
      SELECT a."id" as id1, b."id" as id2,
             similarity(a."title", b."title") as similarity
      FROM "Listing" a
      JOIN "Listing" b ON a."id" < b."id"
        AND a."stateCode" = b."stateCode"
        AND a."sourceId" != b."sourceId"
        AND a."canonicalId" IS NULL
        AND b."canonicalId" IS NULL
        AND a."status" = 'ACTIVE'
        AND b."status" = 'ACTIVE'
        AND similarity(a."title", b."title") > 0.65
      WHERE (
        a."askingPrice" IS NOT NULL AND b."askingPrice" IS NOT NULL
        AND ABS(a."askingPrice"::numeric - b."askingPrice"::numeric) < (a."askingPrice"::numeric * 0.1)
      )
      LIMIT 1000
    `;

        let fuzzyMerged = 0;
        for (const pair of fuzzyDupes) {
            const canonical = await prisma.listing.findFirst({
                where: { id: { in: [pair.id1, pair.id2] }, canonicalId: null },
                orderBy: { firstSeenAt: 'asc' },
            });
            if (!canonical) continue;
            const dupeId = canonical.id === pair.id1 ? pair.id2 : pair.id1;
            await prisma.listing.update({
                where: { id: dupeId },
                data: { canonicalId: canonical.id },
            });
            fuzzyMerged++;
        }
        merged += fuzzyMerged;
        console.log(`[dedup] Fuzzy merges: ${fuzzyMerged}`);
    } catch (e) {
        // pg_trgm extension may not be installed yet
        console.warn('[dedup] Fuzzy match skipped (pg_trgm may not be available):', e);
    }

    return { merged };
}
