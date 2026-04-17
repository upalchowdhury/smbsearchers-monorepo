export interface SearchFilters {
  query?: string;
  askingPriceMin?: number;
  askingPriceMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  cashFlowMin?: number;
  cashFlowMax?: number;
  multipleMin?: number;
  multipleMax?: number;
  industries?: string[];
  businessTypes?: string[];
  states?: string[];
  metroAreas?: string[];
  zipCode?: string;
  radiusMiles?: number;
  isFranchise?: boolean;
  isAbsenteeOwner?: boolean;
  isHomeBased?: boolean;
  hasRealEstate?: boolean;
  sellerFinancing?: boolean;
  yearEstablishedMin?: number;
  employeesMin?: number;
  employeesMax?: number;
  sources?: string[];
  status?: string[];
  daysOnMarketMax?: number;
  newSince?: Date;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'cash_flow_desc' | 'multiple_asc';
  page?: number;
  pageSize?: number;
}

export const INDUSTRY_TAXONOMY = [
  'Restaurants & Food',
  'Retail',
  'Services',
  'Construction',
  'Manufacturing',
  'Healthcare & Medical',
  'Technology & SaaS',
  'E-commerce',
  'Transportation',
  'Gas Stations & Car Washes',
  'Automotive',
  'Education',
  'Real Estate',
  'Finance & Insurance',
  'Agriculture',
  'Entertainment & Recreation',
  'Professional Services',
  'Wholesale & Distribution',
  'Cleaning & Maintenance',
  'Beauty & Personal Care',
  'Travel & Hospitality',
  'Media & Marketing',
  'Franchise',
  'Other',
] as const;

export type Industry = (typeof INDUSTRY_TAXONOMY)[number];
