export type RestaurantViewMode = 'list' | 'map';

export type RestaurantQualityMode = 'off' | 'smart' | 'strict';

export type RestaurantQualityLabel =
  | 'Sehr gut'
  | 'Solide'
  | 'Top Qualität'
  | 'Wenig Daten';

export type WineProfileBadge =
  | 'Sommelier'
  | 'Vinothek'
  | 'Weinbar'
  | 'Weinkarte';

export type WineProfile = {
  badges: WineProfileBadge[];
  hasSommelier: boolean;
  hasWineCard: boolean;
  isFullWineProfile: boolean;
  isWineBar: boolean;
  wineMentions: number;
  wineScore: 0 | 1 | 2 | 3;
};

export type RestaurantAiOccasion =
  | 'quick_bite'
  | 'nice_evening'
  | 'special_experience'
  | 'travel'
  | 'wine_focus';

export type RestaurantAiConfidence = 'high' | 'low' | 'medium';

export type RestaurantAiRoleLabel =
  | 'Beste Wahl'
  | 'Beste Wein-Option'
  | 'Besonderes Erlebnis'
  | 'Preis-Leistung'
  | 'Sichere Wahl';

export type Coordinates = {
  lat: number;
  lng: number;
};

export type RestaurantMapRegion = {
  latitude: number;
  latitudeDelta: number;
  longitude: number;
  longitudeDelta: number;
};

export type RestaurantBounds = {
  northEast: Coordinates;
  southWest: Coordinates;
};

export type RestaurantSearchFilters = {
  cuisine?: string;
  cuisineTypes?: string[];
  minRating?: number;
  openNow?: boolean;
  priceLevels?: string[];
  qualityMode?: RestaurantQualityMode;
  radiusMeters?: number;
};

export type RestaurantRecord = {
  address: string | null;
  cuisine: string | null;
  distanceMeters: number | null;
  googleMapsUri: string | null;
  id: string;
  isOpenNow: boolean | null;
  location: Coordinates;
  name: string;
  openingHoursText: string[];
  phone: string | null;
  photoRefs: string[];
  photoUrl: string | null;
  priceLevel: string | null;
  provider: 'fallback' | 'google_places';
  providerPlaceId: string;
  qualityLabel: RestaurantQualityLabel | null;
  qualityScore: number | null;
  qualitySignals: string[];
  rating: number | null;
  ratingCount: number | null;
  source: 'fallback' | 'google_places';
  types: string[];
  websiteUrl: string | null;
  wineProfile?: WineProfile | null;
};

export type SavedRestaurantRecord = {
  id: string;
  restaurant: RestaurantRecord | null;
  restaurantId: string;
  restaurantKey: string;
};

export type RestaurantRatingRecord = {
  id: string;
  notes: string | null;
  overall_stars: number;
  restaurant_id: string;
  visited_at: string | null;
  wine_stars: number;
};

export type RestaurantVisitRecord = {
  id: string;
  inventory_item_id: string | null;
  notes: string | null;
  restaurant_id: string;
  visited_at: string;
  vintage_id: string | null;
};

export type RestaurantVisitListItem = RestaurantVisitRecord & {
  wineLabel: string | null;
};

export type RestaurantSearchInput = {
  bounds: RestaurantBounds;
  center: Coordinates;
  filters?: RestaurantSearchFilters;
};

export type RestaurantSearchResult = {
  data: RestaurantRecord[];
  source: 'fallback' | 'google_places';
};

export type RestaurantDetailInput = {
  center?: Coordinates;
  provider?: RestaurantRecord['provider'];
  providerPlaceId?: string;
  restaurantId?: string;
};

export type GeocodedCity = {
  label: string;
  region: RestaurantMapRegion;
};

export type RestaurantAiRecommendation = {
  confidence: RestaurantAiConfidence;
  headline: string;
  matchingInventoryItemIds: string[];
  providerPlaceId: string;
  rank: number;
  reason: string;
  restaurant: RestaurantRecord;
  restaurantId: string;
  reviewSignals: string[];
  roleLabel: RestaurantAiRoleLabel;
  score: number;
  strengths: string[];
  watchouts: string[];
  wineFit: string | null;
};

export type RestaurantRecommendationRun = {
  contextLabel: string;
  expiresAt: string;
  generatedAt: string;
  id: string;
  occasion: RestaurantAiOccasion;
  recommendations: RestaurantAiRecommendation[];
};

export type AnalyzeRestaurantsInput = {
  center?: Coordinates;
  contextLabel: string;
  filters?: RestaurantSearchFilters;
  occasion: RestaurantAiOccasion;
  restaurants: RestaurantRecord[];
};
