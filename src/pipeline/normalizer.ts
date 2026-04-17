import { createHash } from 'crypto';
import { RawListing } from '../scrapers/base';

export interface NormalizedListing {
    sourceListingId: string;
    sourceUrl: string;
    title: string;
    description: string | null;
    descriptionClean: string | null;
    askingPrice: bigint | null;
    askingPriceRaw: string | null;
    revenue: bigint | null;
    revenueRaw: string | null;
    cashFlow: bigint | null;
    cashFlowRaw: string | null;
    cashFlowType: string | null;
    multiple: number | null;
    industry: string | null;
    industryNormalized: string | null;
    businessType: string | null;
    city: string | null;
    state: string | null;
    stateCode: string | null;
    country: string;
    zipCode: string | null;
    brokerName: string | null;
    brokerCompany: string | null;
    brokerPhone: string | null;
    brokerEmail: string | null;
    yearEstablished: number | null;
    employees: number | null;
    isFranchise: boolean | null;
    sellerFinancing: boolean | null;
    isAbsenteeOwner: boolean | null;
    isHomeBased: boolean | null;
    hasRealEstate: boolean | null;
    reasonForSelling: string | null;
    dedupeHash: string;
}

export function normalizeListing(raw: RawListing): NormalizedListing {
    const askingPrice = parseCurrency(raw.askingPriceRaw);
    const cashFlow = parseCurrency(raw.cashFlowRaw);
    const revenue = parseCurrency(raw.revenueRaw);
    const stateCode = normalizeState(raw.state);

    return {
        sourceListingId: raw.sourceListingId,
        sourceUrl: raw.sourceUrl,
        title: cleanText(raw.title),
        description: raw.description || null,
        descriptionClean: raw.description ? stripHtml(raw.description) : null,
        askingPrice,
        askingPriceRaw: raw.askingPriceRaw || null,
        revenue,
        revenueRaw: raw.revenueRaw || null,
        cashFlow,
        cashFlowRaw: raw.cashFlowRaw || null,
        cashFlowType: raw.cashFlowType || null,
        multiple:
            askingPrice && cashFlow && cashFlow > 0n
                ? Number(askingPrice) / Number(cashFlow)
                : null,
        industry: raw.industry || null,
        industryNormalized: mapIndustry(raw.industry, raw.title, raw.description),
        businessType: raw.businessType || null,
        city: raw.city ? titleCase(raw.city.slice(0, 100)) : null,
        state: stateCode ? STATE_NAMES[stateCode] : (raw.state || null),
        stateCode,
        country: 'US',
        zipCode: raw.zipCode || null,
        brokerName: raw.brokerName || null,
        brokerCompany: raw.brokerCompany || null,
        brokerPhone: normalizePhone(raw.brokerPhone),
        brokerEmail: raw.brokerEmail?.toLowerCase() || null,
        yearEstablished: raw.yearEstablished || null,
        employees: raw.employees || null,
        isFranchise: raw.isFranchise ?? null,
        sellerFinancing: raw.sellerFinancing ?? null,
        isAbsenteeOwner: raw.isAbsenteeOwner ?? null,
        isHomeBased: raw.isHomeBased ?? null,
        hasRealEstate: raw.hasRealEstate ?? null,
        reasonForSelling: raw.reasonForSelling || null,
        dedupeHash: generateDedupeHash(raw),
    };
}

// ---- Currency Parsing ----

function parseCurrency(raw?: string): bigint | null {
    if (!raw) return null;
    let cleaned = raw.replace(/[^0-9.,kKmMbB-]/g, '').trim();
    if (!cleaned || cleaned === '-') return null;

    let multiplier = 100; // cents
    const suffix = cleaned.slice(-1).toUpperCase();
    if (suffix === 'K') { multiplier = 100_000; cleaned = cleaned.slice(0, -1); }
    else if (suffix === 'M') { multiplier = 100_000_000; cleaned = cleaned.slice(0, -1); }
    else if (suffix === 'B') { multiplier = 100_000_000_000; cleaned = cleaned.slice(0, -1); }

    cleaned = cleaned.replace(/,/g, '');
    const value = parseFloat(cleaned);
    if (isNaN(value) || value <= 0) return null;
    return BigInt(Math.round(value * multiplier));
}

// ---- Text Cleaning ----

function cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function titleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- State Normalization ----

const STATE_CODES: Record<string, string> = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
    california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
    florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
    illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
    kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
    massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
    missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
    oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
    vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
    wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

export const STATE_NAMES: Record<string, string> = Object.fromEntries(
    Object.entries(STATE_CODES).map(([name, code]) => [code, titleCase(name)])
);

function normalizeState(state?: string): string | null {
    if (!state) return null;
    const cleaned = state.trim().toLowerCase();
    if (cleaned.length === 2) {
        const upper = cleaned.toUpperCase();
        if (Object.values(STATE_CODES).includes(upper)) return upper;
    }
    return STATE_CODES[cleaned] || null;
}

function normalizePhone(phone?: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return phone.trim().slice(0, 20);
}

// ---- Dedup Hash ----

function generateDedupeHash(raw: RawListing): string {
    const parts = [
        raw.title?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50) || '',
        parseCurrency(raw.askingPriceRaw)?.toString() || '',
        normalizeState(raw.state) || '',
        raw.city?.toLowerCase().replace(/[^a-z]/g, '').slice(0, 20) || '',
    ].join('|');
    return createHash('sha256').update(parts).digest('hex').slice(0, 16);
}

// ---- Industry Mapping ----

function mapIndustry(rawIndustry?: string, title?: string, desc?: string): string | null {
    if (!rawIndustry && !title) return null;
    const text = `${rawIndustry || ''} ${title || ''}`.toLowerCase();

    if (text.match(/restaurant|food|café|cafe|pizza|bar |grill|bakery|catering|coffee|deli/)) return 'Restaurants & Food';
    if (text.match(/saas|software|app |tech|platform|ai |machine learning|cloud|subscription/)) return 'Technology & SaaS';
    if (text.match(/ecommerce|e-commerce|shopify|amazon|fba|online store|dropship|marketplace/)) return 'E-commerce';
    if (text.match(/retail|store|shop(?!ify)|boutique|clothing|apparel|gift/)) return 'Retail';
    if (text.match(/construct|contractor|plumb|electric|hvac|roof|pav|build|renovation/)) return 'Construction';
    if (text.match(/health|medical|dental|clinic|pharmacy|chiro|therapy|physio|veterinar/)) return 'Healthcare & Medical';
    if (text.match(/manufactur|fabricat|produc|machining|assembly|industrial/)) return 'Manufacturing';
    if (text.match(/transport|truck|freight|logistic|moving|courier|delivery/)) return 'Transportation';
    if (text.match(/gas station|car wash|auto.*detail|lube|fuel/)) return 'Gas Stations & Car Washes';
    if (text.match(/auto|mechanic|tire|collision|body shop|dealership/)) return 'Automotive';
    if (text.match(/clean|janitorial|maid|laundry|dry clean|pressure wash/)) return 'Cleaning & Maintenance';
    if (text.match(/salon|spa|barber|beauty|nail|massage/)) return 'Beauty & Personal Care';
    if (text.match(/franchise/)) return 'Franchise';
    if (text.match(/hotel|motel|hostel|resort|airbnb|travel|tourism/)) return 'Travel & Hospitality';
    if (text.match(/media|marketing|agency|pr |publishing|advertising|seo/)) return 'Media & Marketing';
    if (text.match(/education|tutoring|school|training|daycare|childcare/)) return 'Education';
    if (text.match(/wholesale|distribut|import|export|supply chain/)) return 'Wholesale & Distribution';
    if (text.match(/financial|insurance|accounting|tax|bookkeeping|mortgage/)) return 'Finance & Insurance';
    if (text.match(/farm|agriculture|crop|livestock|nursery|landscap/)) return 'Agriculture';
    if (text.match(/gym|fitness|sport|recreation|entertainment|event|studio/)) return 'Entertainment & Recreation';
    if (text.match(/consult|professional|law|legal|engineer|architect/)) return 'Professional Services';
    if (text.match(/service/)) return 'Services';
    return 'Other';
}
