import { NextRequest, NextResponse } from 'next/server';

// POST /api/scrape — Trigger a scrape job
// Accepts both JSON and form-encoded submissions (admin UI uses a form)
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let source: string | null = null;
        let isFormSubmit = false;

        if (contentType.includes('application/json')) {
            const body = await request.json();
            source = body.source;
        } else {
            // HTML form submission (application/x-www-form-urlencoded)
            const formData = await request.formData();
            source = formData.get('source') as string | null;
            isFormSubmit = true;
        }

        if (!source) {
            return NextResponse.json({ error: 'source is required' }, { status: 400 });
        }

        const validSources = ['bizbuysell', 'bizquest', 'acquire', 'transworld', 'quietlight'];
        if (!validSources.includes(source)) {
            return NextResponse.json({ error: `Invalid source. Valid: ${validSources.join(', ')}` }, { status: 400 });
        }

        const { Queue } = await import('bullmq');
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        const scrapeQueue = new Queue('scrape', {
            connection: { host: new URL(redisUrl).hostname, port: parseInt(new URL(redisUrl).port || '6379') },
        });

        const job = await scrapeQueue.add(`manual-scrape-${source}`, { source });
        await scrapeQueue.close();

        // Redirect back to admin page for form submissions
        if (isFormSubmit) {
            return NextResponse.redirect(new URL('/admin?queued=' + source, request.url));
        }

        return NextResponse.json({ jobId: job.id, source, status: 'queued' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
