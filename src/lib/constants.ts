export const INDUSTRIES = [
  "Manufacturing",
  "Service Businesses",
  "Automotive & Boat",
  "Food & Beverage",
  "Entertainment, Leisure, & Recreation",
  "Retail Stores",
  "Online & Technology",
  "Clothing & Fashion",
  "Building & Construction",
  "Real Estate",
  "Beauty & Personal Care",
  "Financial Services",
  "Healthcare, Medical, & Fitness",
  "Education & Children",
  "Professional Services",
  "Transportation",
] as const;

export const INDUSTRY_COLORS: Record<string, { bg: string; text: string }> = {
  Manufacturing: { bg: "bg-amber-50", text: "text-amber-700" },
  "Service Businesses": { bg: "bg-sky-50", text: "text-sky-700" },
  "Automotive & Boat": { bg: "bg-slate-100", text: "text-slate-700" },
  "Food & Beverage": { bg: "bg-orange-50", text: "text-orange-700" },
  "Entertainment, Leisure, & Recreation": {
    bg: "bg-purple-50",
    text: "text-purple-700",
  },
  "Retail Stores": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Online & Technology": { bg: "bg-blue-50", text: "text-blue-700" },
  "Clothing & Fashion": { bg: "bg-pink-50", text: "text-pink-700" },
  "Building & Construction": { bg: "bg-stone-100", text: "text-stone-700" },
  "Real Estate": { bg: "bg-teal-50", text: "text-teal-700" },
  "Beauty & Personal Care": { bg: "bg-rose-50", text: "text-rose-700" },
  "Financial Services": { bg: "bg-indigo-50", text: "text-indigo-700" },
  "Healthcare, Medical, & Fitness": {
    bg: "bg-green-50",
    text: "text-green-700",
  },
  "Education & Children": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "Professional Services": { bg: "bg-violet-50", text: "text-violet-700" },
  Transportation: { bg: "bg-cyan-50", text: "text-cyan-700" },
};

export const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
] as const;
