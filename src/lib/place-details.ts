const websiteCache = new Map<string, boolean>();

export async function placeHasWebsite(
  apiKey: string,
  placeId: string
): Promise<boolean> {
  if (!placeId) {
    return false;
  }

  if (websiteCache.has(placeId)) {
    return websiteCache.get(placeId) ?? false;
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
      websiteCache.set(placeId, false);
      return false;
    }

    const website =
      typeof data.result?.website === "string"
        ? data.result.website.trim()
        : "";

    const hasWebsite = website.length > 0;
    websiteCache.set(placeId, hasWebsite);
    return hasWebsite;
  } catch {
    websiteCache.set(placeId, false);
    return false;
  }
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
