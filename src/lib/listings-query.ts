import { Prisma } from '@prisma/client';
import { prisma, serializeListings } from '@/lib/db';
import { getCache, setCache } from '@/lib/redis';

export type ListingsSearchResult = {
  listings: unknown[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    cached?: boolean;
  };
};

const CACHE_PREFIX = 'listings:v2:';
const CACHE_TTL_SECONDS = Number(process.env.DEALS_CACHE_TTL_SECONDS || '300');

function toBigIntCents(value: string | null): bigint | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return BigInt(Math.round(n * 100));
}

function parseStringList(value: string | null): string[] | null {
  if (!value) return null;
  const parts = value.split(',').map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : null;
}

function getSort(sortBy: string): Prisma.ListingOrderByWithRelationInput {
  const map: Record<string, Prisma.ListingOrderByWithRelationInput> = {
    newest: { firstSeenAt: 'desc' },
    oldest: { firstSeenAt: 'asc' },
    price_asc: { askingPrice: 'asc' },
    price_desc: { askingPrice: 'desc' },
    revenue_asc: { revenue: 'asc' },
    revenue_desc: { revenue: 'desc' },
    cash_flow_asc: { cashFlow: 'asc' },
    cash_flow_desc: { cashFlow: 'desc' },
    multiple_asc: { multiple: 'asc' },
    multiple_desc: { multiple: 'desc' },
  };
  return map[sortBy] || map.newest;
}

export async function searchListings(searchParams: URLSearchParams): Promise<ListingsSearchResult> {
  const page = Number.parseInt(searchParams.get('page') || '1', 10);
  const pageSize = Math.min(Number.parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '25', 10), 100);
  const skip = (page - 1) * pageSize;

  // Support both naming conventions (`q`/`keyword`, `priceMin`/`minPrice`, etc.)
  const query = searchParams.get('q') || searchParams.get('keyword') || undefined;
  const priceMin = toBigIntCents(searchParams.get('priceMin') || searchParams.get('minPrice'));
  const priceMax = toBigIntCents(searchParams.get('priceMax') || searchParams.get('maxPrice'));
  const revenueMin = toBigIntCents(searchParams.get('revenueMin') || searchParams.get('minRevenue'));
  const revenueMax = toBigIntCents(searchParams.get('revenueMax') || searchParams.get('maxRevenue'));
  const cashFlowMin = toBigIntCents(searchParams.get('cashFlowMin') || searchParams.get('minCashFlow'));
  const cashFlowMax = toBigIntCents(searchParams.get('cashFlowMax') || searchParams.get('maxCashFlow'));
  const industries = parseStringList(searchParams.get('industries'));
  const states = parseStringList(searchParams.get('states'));
  const sources = parseStringList(searchParams.get('sources'));
  const sortBy = searchParams.get('sort') || 'newest';

  const cacheKey = `${CACHE_PREFIX}${searchParams.toString() || 'default'}`;
  const cached = await getCache<ListingsSearchResult>(cacheKey);
  if (cached) {
    return { ...cached, pagination: { ...cached.pagination, cached: true } };
  }

  const where: Prisma.ListingWhereInput = {
    status: 'ACTIVE',
    canonicalId: null,
  };

  if (priceMin !== null || priceMax !== null) {
    where.askingPrice = {
      ...(priceMin !== null ? { gte: priceMin } : {}),
      ...(priceMax !== null ? { lte: priceMax } : {}),
    };
  }

  if (revenueMin !== null || revenueMax !== null) {
    where.revenue = {
      ...(revenueMin !== null ? { gte: revenueMin } : {}),
      ...(revenueMax !== null ? { lte: revenueMax } : {}),
    };
  }

  if (cashFlowMin !== null || cashFlowMax !== null) {
    where.cashFlow = {
      ...(cashFlowMin !== null ? { gte: cashFlowMin } : {}),
      ...(cashFlowMax !== null ? { lte: cashFlowMax } : {}),
    };
  }

  if (industries) where.industryNormalized = { in: industries };
  if (states) where.stateCode = { in: states };
  if (sources) where.source = { name: { in: sources } };

  if (searchParams.get('sellerFinancing') === 'true') where.sellerFinancing = true;
  if (searchParams.get('franchise') === 'true') where.isFranchise = true;
  if (searchParams.get('absentee') === 'true') where.isAbsenteeOwner = true;

  if (query) {
    // Text search fallback that also keeps simple filters applied above.
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { industryNormalized: { contains: query, mode: 'insensitive' } },
      { city: { contains: query, mode: 'insensitive' } },
      { stateCode: { contains: query, mode: 'insensitive' } },
    ];
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: getSort(sortBy),
      skip,
      take: pageSize,
      include: { source: { select: { name: true, baseUrl: true } } },
    }),
    prisma.listing.count({ where }),
  ]);

  const payload: ListingsSearchResult = {
    listings: serializeListings(listings),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL_SECONDS);
  return payload;
}
