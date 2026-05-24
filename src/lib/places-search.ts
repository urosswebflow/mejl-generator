import { getDistrictsForCity } from "@/lib/city-districts";
import {
  buildSearchGrid,
  gridSizeForLimit,
  haversineMeters,
  type CitySearchBounds,
  type GridCell,
} from "@/lib/geo";
import {
  detectCategory,
  getNearbyKeyword,
  type ProfessionCategory,
} from "@/lib/profession-categories";
import { normalizeText } from "@/lib/text-normalize";

/** Google Text/Nearby Search dozvoljava do 3 stranice po upitu. */
export const MAX_PAGES_PER_QUERY = 3;

const PAGE_TOKEN_DELAY_MS = 2500;

export type PlaceResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  user_ratings_total?: number;
  rating?: number;
  types?: string[];
  geometry?: {
    location?: { lat?: number; lng?: number };
  };
};

function passesCityAddressFallback(place: PlaceResult, city: string) {
  const normalizedCity = normalizeText(city);
  const normalizedAddress = normalizeText(place.formatted_address || "");

  if (!normalizedCity || !normalizedAddress) {
    return false;
  }

  return normalizedAddress.includes(normalizedCity);
}

/** Gradski filter: udaljenost od centra grada (geokod), sa fallback na adresu. */
export function passesCityFilter(
  place: PlaceResult,
  city: string,
  bounds: CitySearchBounds
) {
  const lat = place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng;

  if (typeof lat === "number" && typeof lng === "number") {
    return (
      haversineMeters(bounds.center, { lat, lng }) <= bounds.radiusMeters
    );
  }

  return passesCityAddressFallback(place, city);
}

function getContextKeywords(
  profession: string,
  category: ProfessionCategory | null
) {
  const keywords = new Set<string>();

  for (const word of normalizeText(profession).split(" ")) {
    if (word.length > 2) {
      keywords.add(word);
    }
  }

  if (category) {
    for (const phrase of category.phrases) {
      keywords.add(normalizeText(phrase));
      for (const word of normalizeText(phrase).split(" ")) {
        if (word.length > 2) {
          keywords.add(word);
        }
      }
    }

    for (const matcher of category.matchers) {
      keywords.add(normalizeText(matcher));
    }
  }

  return [...keywords];
}

function passesContextFilter(
  place: PlaceResult,
  profession: string,
  category: ProfessionCategory | null
) {
  if (!category) {
    return true;
  }

  const placeTypes = place.types || [];
  if (category.irrelevantTypes?.some((type) => placeTypes.includes(type))) {
    return false;
  }

  const searchableText = normalizeText(
    `${place.name || ""} ${place.formatted_address || ""}`
  );

  const keywords = getContextKeywords(profession, category);

  return keywords.some((keyword) => searchableText.includes(keyword));
}

export function filterPlaces(
  places: PlaceResult[],
  city: string,
  profession: string,
  category: ProfessionCategory | null,
  bounds: CitySearchBounds
) {
  return places.filter(
    (place) =>
      passesCityFilter(place, city, bounds) &&
      passesContextFilter(place, profession, category)
  );
}

export function buildSearchQueries(profession: string, city: string) {
  const trimmedProfession = profession.trim();
  const trimmedCity = city.trim();
  const normalizedProfession = normalizeText(trimmedProfession);

  const queryPhrases = new Set<string>([
    `${trimmedProfession} ${trimmedCity}`,
    `${trimmedProfession} u ${trimmedCity}`,
  ]);

  const category = detectCategory(normalizedProfession);
  const corePhrases: string[] = [trimmedProfession];

  if (category) {
    for (const phrase of category.phrases) {
      queryPhrases.add(`${phrase} ${trimmedCity}`);
      corePhrases.push(phrase);
    }
  } else {
    const genericPhrases = [
      `${trimmedProfession} blizu ${trimmedCity}`,
      `${trimmedProfession} usluge ${trimmedCity}`,
      `${trimmedProfession} firma ${trimmedCity}`,
      `${trimmedProfession} radnja ${trimmedCity}`,
      `${trimmedProfession} studio ${trimmedCity}`,
      `${trimmedProfession} salon ${trimmedCity}`,
      `${trimmedProfession} servis ${trimmedCity}`,
    ];

    for (const phrase of genericPhrases) {
      queryPhrases.add(phrase);
    }
  }

  const districts = getDistrictsForCity(trimmedCity);
  const uniqueCore = [...new Set(corePhrases)].slice(0, 6);

  for (const district of districts) {
    for (const phrase of uniqueCore) {
      queryPhrases.add(`${phrase} ${district} ${trimmedCity}`);
      queryPhrases.add(`${phrase} ${district}`);
    }
  }

  return [...queryPhrases];
}

async function fetchGooglePlacesPage(
  apiKey: string,
  query: string,
  pageToken?: string
) {
  const baseUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json";

  const url = pageToken
    ? `${baseUrl}?pagetoken=${pageToken}&key=${apiKey}`
    : `${baseUrl}?query=${encodeURIComponent(query)}&key=${apiKey}`;

  const response = await fetch(url);
  return response.json();
}

async function fetchNearbyPlacesPage(
  apiKey: string,
  cell: GridCell,
  keyword: string,
  pageToken?: string
) {
  const baseUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

  const url = pageToken
    ? `${baseUrl}?pagetoken=${pageToken}&key=${apiKey}`
    : `${baseUrl}?location=${cell.lat},${cell.lng}&radius=${cell.radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;

  const response = await fetch(url);
  return response.json();
}

type PaginatedFetcher = (
  pageToken?: string
) => Promise<{ status?: string; results?: PlaceResult[]; next_page_token?: string }>;

async function collectPaginatedResults(fetchPage: PaginatedFetcher) {
  const results: PlaceResult[] = [];
  let nextPageToken: string | undefined;
  let pageIndex = 0;

  while (true) {
    if (nextPageToken) {
      await new Promise((resolve) => setTimeout(resolve, PAGE_TOKEN_DELAY_MS));
    }

    const data = await fetchPage(nextPageToken);
    const pageResults = (data.results || []) as PlaceResult[];

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      break;
    }

    if (pageResults.length === 0) {
      break;
    }

    results.push(...pageResults);

    if (!data.next_page_token || pageIndex + 1 >= MAX_PAGES_PER_QUERY) {
      break;
    }

    nextPageToken = data.next_page_token;
    pageIndex += 1;
  }

  return results;
}

export type PlacesCollector = {
  addResults: (results: PlaceResult[]) => void;
  filteredCount: () => number;
};

export function createPlacesCollector(
  map: Map<string, PlaceResult>,
  city: string,
  profession: string,
  category: ProfessionCategory | null,
  bounds: CitySearchBounds
): PlacesCollector {
  return {
    addResults(results: PlaceResult[]) {
      for (const place of results) {
        if (place.place_id && !map.has(place.place_id)) {
          map.set(place.place_id, place);
        }
      }
    },
    filteredCount() {
      return filterPlaces(
        Array.from(map.values()),
        city,
        profession,
        category,
        bounds
      ).length;
    },
  };
}

export async function runTextSearchQueries(
  apiKey: string,
  queries: string[],
  collector: PlacesCollector,
  limit: number
) {
  for (const query of queries) {
    if (collector.filteredCount() >= limit) {
      break;
    }

    const results = await collectPaginatedResults((pageToken) =>
      fetchGooglePlacesPage(apiKey, query, pageToken)
    );
    collector.addResults(results);
  }
}

export async function runGridNearbySearch(
  apiKey: string,
  bounds: CitySearchBounds,
  keyword: string,
  collector: PlacesCollector,
  limit: number
) {
  const gridSize = gridSizeForLimit(limit);
  const cells = buildSearchGrid(bounds.viewport, gridSize);

  for (const cell of cells) {
    if (collector.filteredCount() >= limit) {
      break;
    }

    const results = await collectPaginatedResults((pageToken) =>
      fetchNearbyPlacesPage(apiKey, cell, keyword, pageToken)
    );
    collector.addResults(results);
  }
}

export { detectCategory, getNearbyKeyword };
