import {
  boundsFromViewport,
  type CitySearchBounds,
  type CityViewport,
} from "@/lib/geo";

type GeocodeGeometry = {
  location?: { lat?: number; lng?: number };
  viewport?: {
    northeast?: { lat?: number; lng?: number };
    southwest?: { lat?: number; lng?: number };
  };
};

type GeocodeResponse = {
  status?: string;
  results?: Array<{ geometry?: GeocodeGeometry }>;
};

function parseViewport(geometry: GeocodeGeometry | undefined): CityViewport | null {
  const ne = geometry?.viewport?.northeast;
  const sw = geometry?.viewport?.southwest;

  if (
    typeof ne?.lat !== "number" ||
    typeof ne?.lng !== "number" ||
    typeof sw?.lat !== "number" ||
    typeof sw?.lng !== "number"
  ) {
    return null;
  }

  return {
    northeast: { lat: ne.lat, lng: ne.lng },
    southwest: { lat: sw.lat, lng: sw.lng },
  };
}

function resolveGeocodeRegion(country: string) {
  const normalized = country.trim().toLowerCase();

  if (["srbija", "serbia", "rs"].includes(normalized)) {
    return "rs";
  }

  if (
    ["nemačka", "nemacka", "germany", "deutschland", "de"].includes(normalized)
  ) {
    return "de";
  }

  if (["hrvatska", "croatia", "hr"].includes(normalized)) {
    return "hr";
  }

  if (
    ["bosna i hercegovina", "bosnia and herzegovina", "ba"].includes(normalized)
  ) {
    return "ba";
  }

  if (
    ["crna gora", "montenegro", "me"].includes(normalized)
  ) {
    return "me";
  }

  if (
    ["severna makedonija", "north macedonia", "makedonija", "mk"].includes(
      normalized
    )
  ) {
    return "mk";
  }

  return null;
}

/** Geokodira grad + državu i vraća centar + radius za filter i mrežu pretrage. */
export async function geocodeCity(
  apiKey: string,
  city: string,
  country: string
): Promise<CitySearchBounds | null> {
  const trimmedCity = city.trim();
  const trimmedCountry = country.trim();

  if (!trimmedCity || !trimmedCountry) {
    return null;
  }

  const address = `${trimmedCity}, ${trimmedCountry}`;
  const region = resolveGeocodeRegion(trimmedCountry);
  const regionParam = region ? `&region=${region}` : "";
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}${regionParam}&key=${apiKey}`;

  const response = await fetch(url);
  const data = (await response.json()) as GeocodeResponse;

  if (data.status !== "OK" || !data.results?.length) {
    return null;
  }

  const geometry = data.results[0].geometry;
  const viewport = parseViewport(geometry);

  if (viewport) {
    return boundsFromViewport(viewport);
  }

  const lat = geometry?.location?.lat;
  const lng = geometry?.location?.lng;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const delta = 0.08;
  return boundsFromViewport({
    northeast: { lat: lat + delta, lng: lng + delta },
    southwest: { lat: lat - delta, lng: lng - delta },
  });
}
