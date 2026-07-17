export type PlaceWebsiteInfo = {
  hasWebsite: boolean;
  websiteUrl: string | null;
};

const websiteCache = new Map<string, PlaceWebsiteInfo>();

export async function fetchPlaceWebsite(
  apiKey: string,
  placeId: string
): Promise<PlaceWebsiteInfo> {
  if (!placeId) {
    return { hasWebsite: false, websiteUrl: null };
  }

  const cached = websiteCache.get(placeId);

  if (cached) {
    return cached;
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json"
  );
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "website");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      const empty = { hasWebsite: false, websiteUrl: null };
      websiteCache.set(placeId, empty);
      return empty;
    }

    const website =
      typeof data.result?.website === "string"
        ? data.result.website.trim()
        : "";

    const info: PlaceWebsiteInfo = {
      hasWebsite: website.length > 0,
      websiteUrl: website.length > 0 ? website : null,
    };

    websiteCache.set(placeId, info);
    return info;
  } catch {
    const empty = { hasWebsite: false, websiteUrl: null };
    websiteCache.set(placeId, empty);
    return empty;
  }
}

export async function placeHasWebsite(
  apiKey: string,
  placeId: string
): Promise<boolean> {
  const info = await fetchPlaceWebsite(apiKey, placeId);
  return info.hasWebsite;
}

export function passesWebsiteFilter(
  hasWebsite: boolean,
  websiteFilter: "any" | "required" | "forbidden"
) {
  if (websiteFilter === "required") {
    return hasWebsite;
  }

  if (websiteFilter === "forbidden") {
    return !hasWebsite;
  }

  return true;
}
