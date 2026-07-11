type GoogleMapsUrlInput = {
  placeId?: string;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

function buildSearchUrl(query: string, placeId?: string): string {
  const params = new URLSearchParams({
    api: "1",
    query,
  });

  if (placeId) {
    params.set("query_place_id", placeId);
  }

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function nameAddressQuery(name?: string, address?: string): string {
  return [name, address].filter(Boolean).join(", ").trim();
}

export function extractPlaceIdFromLegacyUrl(url: string): string {
  const legacy = url.match(/place_id:([^&?#]+)/i);
  if (legacy?.[1]) {
    return decodeURIComponent(legacy[1]);
  }

  try {
    const fromQuery = new URL(url).searchParams.get("query_place_id");
    if (fromQuery) {
      return fromQuery;
    }
  } catch {
    // Nije validan URL — ignoriši.
  }

  return "";
}

export function resolvePlaceId(placeId?: string, storedUrl?: string): string {
  return placeId?.trim() || extractPlaceIdFromLegacyUrl(storedUrl || "");
}

/** Službeni Google Maps URL format — radi na desktopu i u mobilnoj aplikaciji. */
export function buildGoogleMapsUrl(input: GoogleMapsUrlInput): string {
  const placeId = input.placeId?.trim();
  const textQuery = nameAddressQuery(input.name, input.address);

  const lat = input.lat;
  const lng = input.lng;
  const hasCoords =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const coordsQuery = hasCoords ? `${lat},${lng}` : "";

  if (placeId) {
    const query = textQuery || coordsQuery || " ";
    return buildSearchUrl(query, placeId);
  }

  if (hasCoords) {
    return buildSearchUrl(coordsQuery);
  }

  if (textQuery) {
    return buildSearchUrl(textQuery);
  }

  return "https://www.google.com/maps";
}

export function resolveGoogleMapsUrl(
  storedUrl: string,
  placeId?: string,
  name?: string,
  address?: string
): string {
  const resolvedPlaceId = resolvePlaceId(placeId, storedUrl);

  if (resolvedPlaceId) {
    return buildGoogleMapsUrl({ placeId: resolvedPlaceId, name, address });
  }

  if (storedUrl.includes("api=1")) {
    try {
      const url = new URL(storedUrl);
      const hasQuery = url.searchParams.has("query");
      const hasPlaceId = url.searchParams.has("query_place_id");

      if (hasQuery || !hasPlaceId) {
        return storedUrl;
      }
    } catch {
      // Nastavi sa rekonstrukcijom URL-a.
    }
  }

  return buildGoogleMapsUrl({ name, address });
}
