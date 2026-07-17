export type WebsiteFilter = "any" | "required" | "forbidden";

export type SearchFilters = {
  websiteFilter: WebsiteFilter;
  reviewsMin: number | null;
  reviewsMax: number | null;
};

export function parseWebsiteFilter(value: string | null | undefined): WebsiteFilter {
  if (value === "required" || value === "forbidden") {
    return value;
  }

  return "any";
}

export function parseReviewsBound(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function passesReviewFilter(
  reviews: number,
  reviewsMin: number | null,
  reviewsMax: number | null
) {
  if (reviewsMin !== null && reviews < reviewsMin) {
    return false;
  }

  if (reviewsMax !== null && reviews > reviewsMax) {
    return false;
  }

  return true;
}

export function parseSearchFilters(searchParams: {
  websiteFilter?: string | null;
  reviewsMin?: string | null;
  reviewsMax?: string | null;
}): SearchFilters {
  const reviewsMin = parseReviewsBound(searchParams.reviewsMin ?? null);
  const reviewsMax = parseReviewsBound(searchParams.reviewsMax ?? null);

  if (
    reviewsMin !== null &&
    reviewsMax !== null &&
    reviewsMin > reviewsMax
  ) {
    return {
      websiteFilter: parseWebsiteFilter(searchParams.websiteFilter),
      reviewsMin: reviewsMax,
      reviewsMax: reviewsMin,
    };
  }

  return {
    websiteFilter: parseWebsiteFilter(searchParams.websiteFilter),
    reviewsMin,
    reviewsMax,
  };
}
