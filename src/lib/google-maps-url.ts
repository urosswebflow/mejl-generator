type GoogleMapsUrlInput = {
  placeId?: string;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

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

  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
  }

  const lat = input.lat;
  const lng = input.lng;

  if (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  const query = [input.name, input.address].filter(Boolean).join(", ").trim();

  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
    return storedUrl;
  }

  return buildGoogleMapsUrl({ name, address });
}
