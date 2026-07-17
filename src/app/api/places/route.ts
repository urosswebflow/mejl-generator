import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { geocodeCity } from "@/lib/google-geocode";
import { parseLeadLimit } from "@/lib/limits";
import { placeHasWebsite, passesWebsiteFilter } from "@/lib/place-details";
import {
  buildSearchQueries,
  createPlacesCollector,
  detectCategory,
  filterPlaces,
  getNearbyKeyword,
  runGridNearbySearch,
  runTextSearchQueries,
  type PlaceResult,
} from "@/lib/places-search";
import { buildGoogleMapsUrl } from "@/lib/google-maps-url";
import {
  parseSearchFilters,
  passesReviewFilter,
} from "@/lib/search-filters";
import { normalizeText } from "@/lib/text-normalize";

async function finalizeFilteredPlaces(
  apiKey: string,
  places: PlaceResult[],
  limit: number,
  websiteFilter: "any" | "required" | "forbidden",
  reviewsMin: number | null,
  reviewsMax: number | null
) {
  const reviewFiltered = places
    .sort(
      (a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0)
    )
    .filter((place) =>
      passesReviewFilter(
        place.user_ratings_total || 0,
        reviewsMin,
        reviewsMax
      )
    );

  if (websiteFilter === "any") {
    return reviewFiltered.slice(0, limit);
  }

  const matched: PlaceResult[] = [];

  for (const place of reviewFiltered) {
    if (matched.length >= limit) {
      break;
    }

    if (!place.place_id) {
      continue;
    }

    const hasWebsite = await placeHasWebsite(apiKey, place.place_id);

    if (passesWebsiteFilter(hasWebsite, websiteFilter)) {
      matched.push(place);
    }
  }

  return matched;
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key nije pronađen." },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  const profession = searchParams.get("profession")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  const limit = parseLeadLimit(searchParams.get("limit"));
  const filters = parseSearchFilters({
    websiteFilter: searchParams.get("websiteFilter"),
    reviewsMin: searchParams.get("reviewsMin"),
    reviewsMax: searchParams.get("reviewsMax"),
  });

  if (!profession || !city) {
    return NextResponse.json(
      { error: "Unesite delatnost i grad." },
      { status: 400 }
    );
  }

  if (limit === null) {
    return NextResponse.json(
      { error: "Unesite ispravan broj firmi (ceo broj veći od 0)." },
      { status: 400 }
    );
  }

  const cityBounds = await geocodeCity(apiKey, city);

  if (!cityBounds) {
    return NextResponse.json(
      {
        error: `Grad "${city}" nije pronađen. Proverite naziv (npr. Beograd, Novi Sad).`,
      },
      { status: 400 }
    );
  }

  const category = detectCategory(normalizeText(profession));
  const queries = buildSearchQueries(profession, city);
  const nearbyKeyword = getNearbyKeyword(profession, category);

  const allPlacesMap = new Map<string, PlaceResult>();
  const collector = createPlacesCollector(
    allPlacesMap,
    city,
    profession,
    category,
    cityBounds
  );

  await runTextSearchQueries(apiKey, queries, collector, limit);

  let gridUsed = false;

  if (collector.filteredCount() < limit) {
    gridUsed = true;
    await runGridNearbySearch(
      apiKey,
      cityBounds,
      nearbyKeyword,
      collector,
      limit
    );
  }

  const rawCount = allPlacesMap.size;
  const baseFiltered = filterPlaces(
    Array.from(allPlacesMap.values()),
    city,
    profession,
    category,
    cityBounds
  );

  const filteredPlaces = await finalizeFilteredPlaces(
    apiKey,
    baseFiltered,
    limit,
    filters.websiteFilter,
    filters.reviewsMin,
    filters.reviewsMax
  );

  const leads = filteredPlaces.map((place) => {
    const address = place.formatted_address || city;

    return {
      placeId: place.place_id || "",
      name: place.name,
      address,
      googleMapsUrl: buildGoogleMapsUrl({
        placeId: place.place_id,
        name: place.name,
        address,
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
      }),
      email: "",
      owner: "",
      reviews: place.user_ratings_total || 0,
      rating: place.rating || null,
    };
  });

  return NextResponse.json({
    leads,
    count: leads.length,
    requested: limit,
    queriesUsed: queries.length,
    filters,
    stats: {
      rawCount,
      filteredCount: baseFiltered.length,
      returnedCount: leads.length,
      gridUsed,
    },
  });
}
