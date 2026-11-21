export const SECTORS = ["insurance", "banking", "fintech", "betting", "telecoms", "healthcare", "education", "ecommerce", "government", "other"] as const;
export const SECTOR_LABEL: Record<(typeof SECTORS)[number], string> = {
  insurance: "Insurance",
  banking: "Banking",
  fintech: "Fintech",
  betting: "Betting and gaming",
  telecoms: "Telecoms",
  healthcare: "Healthcare",
  education: "Education",
  ecommerce: "E-commerce and retail",
  government: "Government",
  other: "Other",
};
export const TIERS = ["uhl", "ehl", "ohl", "unknown"] as const;
export const TIER_LABEL: Record<(typeof TIERS)[number], string> = {
  uhl: "Ultra-High Level",
  ehl: "Extra-High Level",
  ohl: "Ordinary-High Level",
  unknown: "Not yet known",
};

export interface ClientRow {
  id: string;
  name: string;
  rcNumber: string | null;
  sector: (typeof SECTORS)[number];
  ndpcTier: (typeof TIERS)[number];
  domainCount: number;
  lastScanAt: string | null;
  archivedAt: string | null;
}

export interface Domain {
  id: string;
  hostname: string;
  extraUrls: string[];
  authorisation: { current: boolean; by: string | null; at: string; statementVersion: string } | null;
}

export interface ClientDetail extends Omit<ClientRow, "domainCount" | "lastScanAt"> {
  contact: { name?: string; email?: string; phone?: string };
  createdAt: string;
  domains: Domain[];
}
