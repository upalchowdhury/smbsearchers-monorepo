import { NextRequest, NextResponse } from 'next/server';
import { searchListings } from '@/lib/listings-query';

type DealsApiResponse = {
    data: unknown[];
    metadata: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        cached?: boolean;
    };
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    try {
        const result = await searchListings(searchParams);

        const payload: DealsApiResponse = {
            data: result.listings,
            metadata: {
                total: result.pagination.total,
                page: result.pagination.page,
                limit: result.pagination.pageSize,
                totalPages: result.pagination.totalPages,
                cached: result.pagination.cached,
            }
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('Error fetching deals:', error);
        return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
    }
}
