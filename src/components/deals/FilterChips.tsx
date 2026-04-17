import { X } from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';

function formatFilterMoney(value: number | null): string {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
}

export function FilterChips() {
    const { filters, setFilter, clearFilters, getActiveFilterCount } = useFilters();
    const count = getActiveFilterCount();

    if (count === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 pb-4 pt-2">
            <span className="text-xs font-medium text-slate-500">Active Filters:</span>

            {filters.keyword && (
                <Chip label={`Keyword: ${filters.keyword}`} onRemove={() => setFilter('keyword', '')} />
            )}

            {(filters.minPrice || filters.maxPrice) && (
                <Chip
                    label={`Price: ${formatFilterMoney(filters.minPrice)} - ${formatFilterMoney(filters.maxPrice)}`}
                    onRemove={() => { setFilter('minPrice', null); setFilter('maxPrice', null); }}
                />
            )}

            {(filters.minRevenue || filters.maxRevenue) && (
                <Chip
                    label={`Rev: ${formatFilterMoney(filters.minRevenue)} - ${formatFilterMoney(filters.maxRevenue)}`}
                    onRemove={() => { setFilter('minRevenue', null); setFilter('maxRevenue', null); }}
                />
            )}

            {(filters.minCashFlow || filters.maxCashFlow) && (
                <Chip
                    label={`Earnings: ${formatFilterMoney(filters.minCashFlow)} - ${formatFilterMoney(filters.maxCashFlow)}`}
                    onRemove={() => { setFilter('minCashFlow', null); setFilter('maxCashFlow', null); }}
                />
            )}

            {filters.industries.map(ind => (
                <Chip
                    key={ind}
                    label={ind}
                    onRemove={() => setFilter('industries', filters.industries.filter(i => i !== ind))}
                />
            ))}

            {filters.states.map(st => (
                <Chip
                    key={st}
                    label={st}
                    onRemove={() => setFilter('states', filters.states.filter(s => s !== st))}
                />
            ))}

            <button
                onClick={clearFilters}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-2"
            >
                Clear all
            </button>
        </div>
    );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
            {label}
            <button
                type="button"
                onClick={onRemove}
                className="group relative -mr-1 h-3.5 w-3.5 rounded-sm hover:bg-indigo-600/20"
            >
                <span className="sr-only">Remove</span>
                <X className="h-3 w-3" />
            </button>
        </span>
    );
}
