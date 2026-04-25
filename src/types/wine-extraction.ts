export type WineColor = 'weiss' | 'rot' | 'rose' | 'schaum' | 'suess';

export type TasteDryness = 'trocken' | 'halbtrocken' | 'lieblich' | 'suess';

export type WineExtraction = {
  producer: string;
  wine_name: string;
  vintage_year: number | null;
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
  confidence: {
    producer: number;
    wine_name: number;
    vintage_year: number;
    overall: number;
  };
  notes: string;
};
