import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CsvRow = Record<string, string>;

const SOURCE_BASE_URLS: Record<string, string> = {
  bizbuysell: 'https://www.bizbuysell.com',
  bizquest: 'https://www.bizquest.com',
  acquire: 'https://acquire.com',
  transworld: 'https://www.tworld.com',
  quietlight: 'https://quietlight.com',
  flippa: 'https://flippa.com',
  websiteclosers: 'https://www.websiteclosers.com',
  sunbelt: 'https://www.sunbeltnetwork.com',
  moxie: 'https://moxiebizbrokers.com',
  benjaminross: 'https://nda.benjaminrossgroup.com',
};

function inferSourceFromFile(filePath: string): string {
  const file = path.basename(filePath).toLowerCase();
  for (const slug of Object.keys(SOURCE_BASE_URLS)) {
    if (file.startsWith(`${slug}_`) || file.includes(`_${slug}_`) || file === `${slug}.csv`) {
      return slug;
    }
  }
  return file.split('_')[0] || 'unknown';
}

function normalizeState(raw?: string): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  const m = v.match(/\b([A-Z]{2})\b/);
  return m ? m[1] : null;
}

function boolOrNull(raw?: string): boolean | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (['true', 'yes', 'y', '1'].includes(v)) return true;
  if (['false', 'no', 'n', '0'].includes(v)) return false;
  return null;
}

function parseInteger(raw?: string): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9-]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function parseMoneyToCents(raw?: string): bigint | null {
  if (!raw) return null;
  const txt = raw.trim();
  if (!txt) return null;

  const lower = txt.toLowerCase();
  if (/(n\/a|not disclosed|confidential|call|contact|tbd|unknown)/.test(lower)) return null;

  const cleaned = txt
    .replace(/usd|eur|gbp|cad|aud|ttm|revenue|net profit|profit/gi, '')
    .replace(/[,$€£¥]/g, '')
    .trim();

  const m = cleaned.match(/(-?\d+(?:\.\d+)?)\s*([kmb])?/i);
  if (!m) return null;

  const value = Number.parseFloat(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const suffix = (m[2] || '').toLowerCase();
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;

  return BigInt(Math.round(value * multiplier * 100));
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let curr = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        curr += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(curr);
      curr = '';
      continue;
    }

    curr += ch;
  }

  out.push(curr);
  return out;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;

    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = (values[j] ?? '').trim();
    }
    rows.push(row);
  }

  return rows;
}

function collectCsvFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const out: string[] = [];

  for (const e of entries) {
    const full = path.join(dirPath, e.name);
    if (e.isDirectory()) {
      if (e.name === '__pycache__' || e.name.startsWith('.')) continue;
      out.push(...collectCsvFiles(full));
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.csv')) {
      out.push(full);
    }
  }

  return out;
}

function buildDescription(row: CsvRow): string | null {
  const candidate =
    row.description ||
    row.listing_description ||
    row.full_description ||
    row.seller_notes ||
    row.tagline ||
    '';
  const value = candidate.trim();
  return value || null;
}

function buildSourceListingId(row: CsvRow, url: string, fallbackIndex: number): string {
  const explicit = (row.listing_id || '').trim();
  if (explicit) return explicit;

  if (url) {
    const u = url.split('?')[0].replace(/\/+$/, '');
    const seg = u.split('/').pop();
    if (seg) return seg;
  }

  return `csv-${fallbackIndex}`;
}

function inferCashFlowType(row: CsvRow): string | null {
  const explicit = (row.cash_flow_type || '').trim();
  if (explicit) return explicit;
  if (row.net_income) return 'Net Profit';
  if (row.ebitda) return 'EBITDA';
  if (row.cash_flow || row.ttm_profit) return 'Cash Flow';
  return null;
}

async function ensureSource(slug: string): Promise<string> {
  const source = await prisma.source.upsert({
    where: { name: slug },
    update: { updatedAt: new Date(), isActive: true },
    create: {
      name: slug,
      baseUrl: SOURCE_BASE_URLS[slug] || `https://${slug}.com`,
      isActive: true,
    },
    select: { id: true },
  });

  return source.id;
}

function dedupeHashFor(title: string, askingPrice: bigint | null, stateCode: string | null, city: string | null): string {
  const cleanedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
  const cleanedCity = (city || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20);
  const price = askingPrice ? askingPrice.toString() : '';
  return `${cleanedTitle}|${price}|${stateCode || ''}|${cleanedCity}`;
}

async function importFile(filePath: string): Promise<{ processed: number; created: number; updated: number; source: string }> {
  const sourceSlug = inferSourceFromFile(filePath);
  const sourceId = await ensureSource(sourceSlug);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCsv(raw);

  let created = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];

    const url = (row.url || '').trim();
    const title = (row.title || '').trim();
    if (!title || !url) continue;

    const sourceListingId = buildSourceListingId(row, url, i + 1);
    const description = buildDescription(row);
    const askingPriceRaw = (row.asking_price || '').trim() || null;
    const revenueRaw = (row.revenue || row.gross_revenue || row.ttm_revenue || row.arr || '').trim() || null;
    const cashFlowRaw = (row.cash_flow || row.net_income || row.ttm_profit || row.ebitda || '').trim() || null;

    const askingPrice = parseMoneyToCents(askingPriceRaw || undefined);
    const revenue = parseMoneyToCents(revenueRaw || undefined);
    const cashFlow = parseMoneyToCents(cashFlowRaw || undefined);
    const stateCode = normalizeState(row.state || row.location);
    const city = (row.city || '').trim() || null;
    const industry = (row.industry || row.category || '').trim() || null;
    const businessType = (row.business_type || row.business_model || '').trim() || null;
    const cashFlowType = inferCashFlowType(row);
    const yearEstablished = parseInteger(row.year_established || row.founded_year || row.established);
    const employees = parseInteger(row.employees);
    const brokerName = (row.broker_name || row.broker_contact || '').trim() || null;
    const brokerCompany = (row.broker_company || '').trim() || null;
    const brokerPhone = (row.broker_phone || '').trim() || null;

    const dedupeHash = dedupeHashFor(title, askingPrice, stateCode, city);

    const existing = await prisma.listing.findUnique({
      where: {
        sourceId_sourceListingId: {
          sourceId,
          sourceListingId,
        },
      },
      select: { id: true },
    });

    const commonData = {
      sourceUrl: url,
      title,
      description,
      descriptionClean: description,
      industry,
      industryNormalized: industry,
      businessType,
      askingPrice,
      askingPriceRaw,
      revenue,
      revenueRaw,
      cashFlow,
      cashFlowRaw,
      cashFlowType,
      city,
      state: stateCode,
      stateCode,
      country: (row.country || 'US').trim() || 'US',
      brokerName,
      brokerCompany,
      brokerPhone,
      sellerFinancing: boolOrNull(row.seller_financing),
      yearEstablished,
      employees,
      isFranchise: boolOrNull(row.is_franchise),
      hasRealEstate: boolOrNull(row.has_real_estate),
      reasonForSelling: (row.reason_for_selling || '').trim() || null,
      status: 'ACTIVE' as const,
      dedupeHash,
      lastSeenAt: new Date(),
    };

    if (!existing) {
      await prisma.listing.create({
        data: {
          sourceId,
          sourceListingId,
          firstSeenAt: new Date(),
          ...commonData,
        },
      });
      created += 1;
    } else {
      await prisma.listing.update({
        where: { id: existing.id },
        data: {
          ...commonData,
          updatedAt: new Date(),
        },
      });
      updated += 1;
    }
  }

  return {
    processed: rows.length,
    created,
    updated,
    source: sourceSlug,
  };
}

async function main() {
  const defaultDir = path.resolve(process.cwd(), '..', 'scraper', 'csvoutput');
  const csvDir = process.env.SCRAPED_CSV_DIR ? path.resolve(process.env.SCRAPED_CSV_DIR) : defaultDir;

  const files = collectCsvFiles(csvDir)
    .filter((f) => path.basename(f).toLowerCase() !== 'delta_store.py')
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log(`[import] No CSV files found in ${csvDir}`);
    return;
  }

  console.log(`[import] Found ${files.length} CSV files in ${csvDir}`);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const file of files) {
    const res = await importFile(file);
    totalProcessed += res.processed;
    totalCreated += res.created;
    totalUpdated += res.updated;
    console.log(`[import] ${path.basename(file)} | source=${res.source} | rows=${res.processed} | created=${res.created} | updated=${res.updated}`);
  }

  console.log(`\n[import] Done. Processed=${totalProcessed}, created=${totalCreated}, updated=${totalUpdated}`);
}

main()
  .catch((err) => {
    console.error('[import] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
