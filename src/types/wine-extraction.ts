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
