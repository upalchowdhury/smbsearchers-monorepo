import { BizBuySellScraper } from './bizbuysell';
import { BizQuestScraper } from './bizquest';
import { AcquireScraper } from './acquire';
import { TransWorldScraper } from './transworld';
import { QuietLightScraper } from './quietlight';
import { BaseScraper } from './base';

export const SCRAPERS: Record<string, new (...args: any[]) => BaseScraper> = {
    bizbuysell: BizBuySellScraper,
    bizquest: BizQuestScraper,
    acquire: AcquireScraper,
    transworld: TransWorldScraper,
    quietlight: QuietLightScraper,
};

export { BizBuySellScraper, BizQuestScraper, AcquireScraper, TransWorldScraper, QuietLightScraper, BaseScraper };
