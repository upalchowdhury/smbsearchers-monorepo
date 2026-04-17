import { NextRequest, NextResponse } from 'next/server';
import { searchListings } from '@/lib/listings-query';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    try {
        const result = await searchListings(searchParams);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[api/listings] Error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
