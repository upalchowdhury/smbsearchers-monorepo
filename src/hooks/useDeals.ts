import { useQuery } from '@tanstack/react-query';
import { FilterState } from './useFilters';

export function useDeals(page = 1, limit = 50, filters?: FilterState) {
    return useQuery({
        queryKey: ['deals', page, limit, filters],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: limit.toString(),
            });

            if (filters) {
                if (filters.keyword) params.append('keyword', filters.keyword);
                if (filters.minPrice) params.append('minPrice', filters.minPrice.toString());
                if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
                if (filters.minRevenue) params.append('minRevenue', filters.minRevenue.toString());
                if (filters.maxRevenue) params.append('maxRevenue', filters.maxRevenue.toString());
                if (filters.minCashFlow) params.append('minCashFlow', filters.minCashFlow.toString());
                if (filters.maxCashFlow) params.append('maxCashFlow', filters.maxCashFlow.toString());
                if (filters.industries.length > 0) params.append('industries', filters.industries.join(','));
                if (filters.states.length > 0) params.append('states', filters.states.join(','));
            }

            const res = await fetch(`/api/listings?${params.toString()}`);
            if (!res.ok) throw new Error('Network response was not ok');
            return res.json();
        },
    });
}
