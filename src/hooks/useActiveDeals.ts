import { useQuery } from '@tanstack/react-query';
import { Deal, FilterState } from '@/lib/types';

type ListingsApiPage = {
  listings?: unknown[];
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};

type UseActiveDealsParams = {
  page: number;
  pageSize: number;
  filters: FilterState;
  sort: string;
};

type RawUiListing = {
  id?: string;
  title?: string;
  description?: string | null;
  descriptionClean?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  country?: string | null;
  askingPrice?: unknown;
  revenue?: unknown;
  cashFlow?: unknown;
  industryNormalized?: string | null;
  industry?: string | null;
  businessType?: string | null;
  source?: { name?: string | null } | null;
  sourceUrl?: string | null;
  firstSeenAt?: string | null;
  createdAt?: string | null;
};

export function useActiveDeals({ page, pageSize, filters, sort }: UseActiveDealsParams) {
  const toNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  return useQuery({
    queryKey: ['active-deals', page, pageSize, filters, sort],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
      });

      if (filters.search) params.set('keyword', filters.search);
      if (filters.priceMin !== null) params.set('minPrice', String(filters.priceMin));
      if (filters.priceMax !== null) params.set('maxPrice', String(filters.priceMax));
      if (filters.revenueMin !== null) params.set('minRevenue', String(filters.revenueMin));
      if (filters.revenueMax !== null) params.set('maxRevenue', String(filters.revenueMax));
      if (filters.earningsMin !== null) params.set('minCashFlow', String(filters.earningsMin));
      if (filters.earningsMax !== null) params.set('maxCashFlow', String(filters.earningsMax));
      if (filters.industries.length > 0) params.set('industries', filters.industries.join(','));
      if (filters.states.length > 0) params.set('states', filters.states.join(','));

      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch deals');

      const json = (await res.json()) as ListingsApiPage;
      const pageRows = (json.listings || []) as RawUiListing[];

      const deals: Deal[] = pageRows.map((raw, index) => {
        const askingPrice = toNumberOrNull(raw.askingPrice);
        const revenue = toNumberOrNull(raw.revenue);
        const earnings = toNumberOrNull(raw.cashFlow);
        const createdAt = raw.createdAt || new Date().toISOString();
        const listedAt = raw.firstSeenAt || raw.createdAt || createdAt;

        let marginPct = null;
        if (earnings && revenue && revenue > 0) {
          marginPct = parseFloat(((earnings / revenue) * 100).toFixed(1));
        }

        let multiple = null;
        if (askingPrice && earnings && earnings > 0) {
          multiple = parseFloat((askingPrice / earnings).toFixed(1));
        }

        const sourceName = raw.source?.name || 'Direct';
        
        // Generate a stable color based on the title length
        const logoColors = [
          "#1e40af", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
          "#0891b2", "#4f46e5", "#be123c", "#ca8a04", "#059669",
          "#6366f1", "#e11d48", "#0284c7", "#d97706", "#65a30d",
        ];
        const colorIndex = (raw.title?.length || 0) % logoColors.length;
        const safeId = raw.id || raw.sourceUrl || `${raw.title || 'deal'}-${index}`;

        return {
          id: safeId,
          title: raw.title || 'Unknown Business',
          slug: safeId,
          description: raw.description || raw.descriptionClean || '',
          locationCity: raw.city || 'Unknown',
          locationState: raw.stateCode || raw.state || 'Unknown',
          locationCountry: raw.country || 'US',
          askingPrice,
          revenue,
          earnings,
          marginPct,
          multiple,
          industry: raw.industryNormalized || raw.industry || 'Other',
          subIndustry: raw.businessType || 'Other',
          logoColor: logoColors[colorIndex],
          sourceName,
          sourceUrl: raw.sourceUrl || undefined,
          isOffMarket: false,
          isSaved: false,
          status: 'active',
          listedAt,
          createdAt,
        };
      });

      return {
        deals,
        pagination: {
          page: Number(json.pagination?.page || page),
          pageSize: Number(json.pagination?.pageSize || pageSize),
          total: Number(json.pagination?.total || 0),
          totalPages: Number(json.pagination?.totalPages || 1),
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
