import { NextRequest, NextResponse } from 'next/server';
import { prisma, serializeListing } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const listing = await prisma.listing.findUnique({
            where: { id },
            include: {
                source: { select: { name: true, baseUrl: true } },
                duplicates: {
                    select: { id: true, sourceUrl: true, source: { select: { name: true } } },
                },
            },
        });

        if (!listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
        }

        return NextResponse.json(serializeListing(listing));
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
    }
}
