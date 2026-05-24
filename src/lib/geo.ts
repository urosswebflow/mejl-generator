export type LatLng = { lat: number; lng: number };

export type CityViewport = {
  northeast: LatLng;
  southwest: LatLng;
};

export type CitySearchBounds = {
  center: LatLng;
  /** Maksimalna udaljenost od centra grada (metri) za prihvatanje leada. */
  radiusMeters: number;
  viewport: CityViewport;
};

export type GridCell = LatLng & { radiusMeters: number };

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function boundsFromViewport(viewport: CityViewport): CitySearchBounds {
  const center = {
    lat: (viewport.northeast.lat + viewport.southwest.lat) / 2,
    lng: (viewport.northeast.lng + viewport.southwest.lng) / 2,
  };

  const corners: LatLng[] = [
    viewport.northeast,
    viewport.southwest,
    { lat: viewport.northeast.lat, lng: viewport.southwest.lng },
    { lat: viewport.southwest.lat, lng: viewport.northeast.lng },
  ];

  const maxCornerDistance = Math.max(
    ...corners.map((corner) => haversineMeters(center, corner))
  );

  return {
    center,
    radiusMeters: Math.ceil(maxCornerDistance * 1.12),
    viewport,
  };
}

/** Deli viewport grada na mrežu za Nearby Search (svaka ćelija = poseban upit). */
export function buildSearchGrid(
  viewport: CityViewport,
  gridSize: number
): GridCell[] {
  const { northeast: ne, southwest: sw } = viewport;
  const latStep = (ne.lat - sw.lat) / gridSize;
  const lngStep = (ne.lng - sw.lng) / gridSize;
  const cells: GridCell[] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lat = sw.lat + (row + 0.5) * latStep;
      const lng = sw.lng + (col + 0.5) * lngStep;
      const center = { lat, lng };

      const radiusFromLat = haversineMeters(center, {
        lat: lat + latStep / 2,
        lng,
      });
      const radiusFromLng = haversineMeters(center, {
        lat,
        lng: lng + lngStep / 2,
      });

      const radiusMeters = Math.min(
        50_000,
        Math.ceil(Math.max(radiusFromLat, radiusFromLng) * 1.15)
      );

      cells.push({ lat, lng, radiusMeters: Math.max(radiusMeters, 500) });
    }
  }

  return cells;
}

export function gridSizeForLimit(limit: number): number {
  if (limit >= 150) return 4;
  if (limit >= 80) return 3;
  return 3;
}
