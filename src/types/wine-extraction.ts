import type { Tables } from '@/types/database';

export type WineColor = 'weiss' | 'rot' | 'rose' | 'schaum' | 'suess';

export type TasteDryness = 'trocken' | 'halbtrocken' | 'lieblich' | 'suess';

export type WineConfidence = {
  producer: number;
  wine_name: number;
  vintage_year: number;
  overall: number;
};

export type MinimalWineExtraction = {
  estimated_vintage_year: number | null;
  estimated_vintage_year_reason: string | null;
  producer: string;
  wine_name: string;
  vintage_year: number | null;
  confidence: WineConfidence;
};

export type WineExtraction = MinimalWineExtraction & {
  region: string | null;
  country: string | null;
  appellation: string | null;
  grape_variety: string | null;
  wine_color: WineColor | null;
  taste_dryness: TasteDryness | null;
  alcohol_percent: number | null;
  drinking_window_start: number | null;
  drinking_window_end: number | null;
  price_min_eur: number | null;
  price_max_eur: number | null;
  aromas: string[];
  description_short: string | null;
  description_long: string | null;
  food_pairing: string | null;
  serving_temperature: string | null;
  vinification: string | null;
  data_sources: string[];
  notes: string;
};

export type WineRecord = Tables<'wines'>;

export type VintageRecord = Tables<'vintages'>;

export type ScanWineResult =
  | {
      minimal: MinimalWineExtraction;
      source: 'low_confidence';
    }
  | {
      matchedVintage: VintageRecord | null;
      minimal: MinimalWineExtraction;
      source: 'cache';
      vintages: VintageRecord[];
      wine: WineRecord;
    }
  | {
      extraction: WineExtraction;
      matchedVintage: VintageRecord | null;
      minimal: MinimalWineExtraction;
      source: 'fresh';
      vintage: VintageRecord | null;
      vintages: VintageRecord[];
      wine: WineRecord;
    };

export type WineCorrection = {
  ai_value: string;
  field: string;
  user_value: string;
};

export type SaveScanPayload = {
  analysisVintageId?: string | null;
  bottleStoragePath?: string | null;
  corrections: WineCorrection[];
  imageUrl: string;
  selectedVintageYear: number;
  source: 'cache' | 'fresh' | 'manual';
  storagePath: string;
  vintageData: {
    ai_confidence: number | null;
    alcohol_percent: number | null;
    aromas: string[];
    data_sources: string[];
    description_long: string | null;
    description_short: string | null;
    drinking_window_end: number | null;
    drinking_window_start: number | null;
    food_pairing: string | null;
    price_max_eur: number | null;
    price_min_eur: number | null;
    serving_temperature: string | null;
    vinification: string | null;
  };
  wineData: {
    alcohol_percent: number | null;
    appellation: string | null;
    country: string | null;
    grape_variety: string | null;
    producer: string;
    region: string | null;
    taste_dryness: TasteDryness | null;
    wine_color: WineColor | null;
    wine_name: string;
  };
  wineId?: string | null;
};

export type SaveScanResult = {
  scanId: string;
  vintageId: string;
  wineId: string;
};
