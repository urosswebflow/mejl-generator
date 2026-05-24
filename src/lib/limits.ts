export function parseLeadLimit(value: string | null | undefined): number | null {
  const trimmed = String(value ?? "").trim();

  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.floor(parsed);
}

export function isValidLeadLimitInput(value: string): boolean {
  return parseLeadLimit(value) !== null;
}
