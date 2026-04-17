import { Deal } from "./types";

const businessNames = [
  { title: "Leather Goods Manufacturer and E-Co...", industry: "Manufacturing", sub: "Clothing & Footwear Manufacturing", city: "Oklahoma City", state: "Oklahoma" },
  { title: "Wash and Fold Pickup Service", industry: "Service Businesses", sub: "Laundromats & Dry Cleaners", city: "West", state: "Alabama" },
  { title: "Established Used Car Dealership", industry: "Automotive & Boat", sub: "Auto Dealers", city: "Santa Ana", state: "California" },
  { title: "Tile and Stone Showroom", industry: "Service Businesses", sub: "Flooring Contractors", city: "Phoenix", state: "Arizona" },
  { title: "Veterinary Clinic with Real Estate", industry: "Service Businesses", sub: "Veterinarian Services", city: "Libertyville", state: "Illinois" },
  { title: "Turnkey Sushi Restaurant Business", industry: "Food & Beverage", sub: "Restaurants", city: "Doral", state: "Florida" },
  { title: "Full-Service Indian Restaurant and Ban...", industry: "Entertainment, Leisure, & Recreation", sub: "Banquet Halls", city: "Plano", state: "Texas" },
  { title: "Sizzler Franchise Casual Dining", industry: "Retail Stores", sub: "Franchise", city: "San Fernando Valley", state: "California" },
  { title: "Authentic Italian Restaurant with Patio", industry: "Food & Beverage", sub: "Restaurants", city: "Los Angeles", state: "California" },
  { title: "Fully Equipped Bakery and Cafe", industry: "Food & Beverage", sub: "Coffeeshops, Cafes & Dessert Shops", city: "Seattle", state: "Washington" },
  { title: "Ice Cream and Water Refill Shop", industry: "Food & Beverage", sub: "Restaurants", city: "Phoenix", state: "Arizona" },
  { title: "Turnkey Boba Tea Shop", industry: "Food & Beverage", sub: "Restaurants", city: "Hoffman Estates", state: "Illinois" },
  { title: "Turnkey Dessert and Beverage Shop", industry: "Food & Beverage", sub: "Liquor & Wine", city: "Katy", state: "Texas" },
  { title: "Exterior Property Services Company", industry: "Service Businesses", sub: "Property Management", city: "Baton Rouge", state: "Louisiana" },
  { title: "Non-Medical Home Care Agency", industry: "Healthcare, Medical, & Fitness", sub: "Home Health Care", city: "Dallas", state: "Texas" },
  { title: "Premium Auto Detailing Business", industry: "Automotive & Boat", sub: "Auto Detailing", city: "Denver", state: "Colorado" },
  { title: "Cloud-Based SaaS Platform", industry: "Online & Technology", sub: "Software as a Service (SaaS)", city: "Austin", state: "Texas" },
  { title: "Multi-Unit Fitness Franchise", industry: "Healthcare, Medical, & Fitness", sub: "Gyms & Fitness Centers", city: "Tampa", state: "Florida" },
  { title: "Established Plumbing Company", industry: "Building & Construction", sub: "Plumbing", city: "Charlotte", state: "North Carolina" },
  { title: "Boutique Wedding Venue", industry: "Entertainment, Leisure, & Recreation", sub: "Event Venues", city: "Nashville", state: "Tennessee" },
  { title: "Mobile Pet Grooming Service", industry: "Service Businesses", sub: "Pet Services", city: "Portland", state: "Oregon" },
  { title: "Commercial Cleaning Franchise", industry: "Service Businesses", sub: "Janitorial & Cleaning", city: "Atlanta", state: "Georgia" },
  { title: "E-Commerce Fashion Brand", industry: "Clothing & Fashion", sub: "Online Retail", city: "New York", state: "New York" },
  { title: "Family Dental Practice", industry: "Healthcare, Medical, & Fitness", sub: "Dental Practice", city: "Scottsdale", state: "Arizona" },
  { title: "Craft Brewery and Taproom", industry: "Food & Beverage", sub: "Breweries", city: "San Diego", state: "California" },
];

const logoColors = [
  "#1e40af", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#be123c", "#ca8a04", "#059669",
  "#6366f1", "#e11d48", "#0284c7", "#d97706", "#65a30d",
];

// Deterministic pseudo-random for consistent SSR hydration
let seed = 123456789;
function pseudoRandom() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(pseudoRandom() * (max - min + 1)) + min;
}

function generateDeal(index: number): Deal {
  const biz = businessNames[index % businessNames.length];
  const asking = randomBetween(50, 5000) * 1000;
  const revenue = randomBetween(asking * 0.5, asking * 8);
  const earnings = randomBetween(revenue * 0.03, revenue * 0.45);
  const margin = (earnings / revenue) * 100;
  const multiple = asking / earnings;
  const daysAgo = randomBetween(1, 90);
  
  // Use a fixed base date so SSR and client hydration always match
  const date = new Date("2026-03-01T12:00:00Z");
  date.setDate(date.getDate() - daysAgo);

  return {
    id: `deal-${index + 1}`,
    title: biz.title,
    slug: biz.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    description: `Established ${biz.sub.toLowerCase()} business located in ${biz.city}, ${biz.state}. Excellent opportunity for owner-operator or strategic buyer.`,
    locationCity: biz.city,
    locationState: biz.state,
    locationCountry: "United States",
    askingPrice: asking,
    revenue: revenue,
    earnings: earnings,
    marginPct: parseFloat(margin.toFixed(1)),
    multiple: parseFloat(multiple.toFixed(1)),
    industry: biz.industry,
    subIndustry: biz.sub,
    logoUrl: undefined,
    logoColor: logoColors[index % logoColors.length],
    sourceName: ["BizBuySell", "BizQuest", "BusinessBroker", "Direct"][index % 4],
    sourceUrl: "#",
    isOffMarket: index % 7 === 0,
    isSaved: false,
    status: "active",
    listedAt: date.toISOString(),
    createdAt: date.toISOString(),
  };
}

export function generateDeals(count: number = 50): Deal[] {
  return Array.from({ length: count }, (_, i) => generateDeal(i));
}

export const MOCK_DEALS = generateDeals(50);
