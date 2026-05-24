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

/** Geokodira grad (Srbija) i vraća centar + radius za filter i mrežu pretrage. */
export async function geocodeCity(
  apiKey: string,
  city: string
): Promise<CitySearchBounds | null> {
  const address = `${city.trim()}, Serbia`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=rs&key=${apiKey}`;

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
