import { Resend } from "resend";

export type ResendAccountConfig = {
  id: string;
  apiKey: string;
  webhookSecret?: string;
  domains: string[];
};

function parseAccountsJson(raw: string): ResendAccountConfig[] {
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("RESEND_ACCOUNTS mora biti JSON niz.");
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`RESEND_ACCOUNTS[${index}] nije validan objekat.`);
    }

    const record = item as Record<string, unknown>;
    const id =
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : `account-${index + 1}`;
    const apiKey =
      typeof record.apiKey === "string" ? record.apiKey.trim() : "";
    const webhookSecret =
      typeof record.webhookSecret === "string"
        ? record.webhookSecret.trim()
        : undefined;

    let domains: string[] = [];

    if (Array.isArray(record.domains)) {
      domains = record.domains
        .filter((domain): domain is string => typeof domain === "string")
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean);
    } else if (typeof record.domain === "string" && record.domain.trim()) {
      domains = [record.domain.trim().toLowerCase()];
    }

    if (!apiKey) {
      throw new Error(`RESEND_ACCOUNTS[${index}] nema apiKey.`);
    }

    if (domains.length === 0) {
      throw new Error(`RESEND_ACCOUNTS[${index}] nema domains.`);
    }

    return {
      id,
      apiKey,
      webhookSecret,
      domains,
    };
  });
}

export function getResendAccounts(): ResendAccountConfig[] {
  const raw = process.env.RESEND_ACCOUNTS?.trim();

  if (raw) {
    return parseAccountsJson(raw);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!apiKey) {
    return [];
  }

  const domains =
    process.env.RESEND_DOMAINS?.split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean) || [];

  return [
    {
      id: "default",
      apiKey,
      webhookSecret: webhookSecret || undefined,
      domains,
    },
  ];
}

export function getEmailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex === -1) {
    return "";
  }

  return normalized.slice(atIndex + 1);
}

export function resolveResendAccountForEmail(email: string) {
  const domain = getEmailDomain(email);
  const accounts = getResendAccounts();

  if (!domain || accounts.length === 0) {
    return null;
  }

  let bestMatch: ResendAccountConfig | null = null;
  let bestLength = -1;

  for (const account of accounts) {
    for (const accountDomain of account.domains) {
      const normalizedDomain = accountDomain.toLowerCase();

      if (
        domain === normalizedDomain ||
        domain.endsWith(`.${normalizedDomain}`)
      ) {
        if (normalizedDomain.length > bestLength) {
          bestMatch = account;
          bestLength = normalizedDomain.length;
        }
      }
    }
  }

  return bestMatch;
}

export function getResendClientForEmail(email: string) {
  const account = resolveResendAccountForEmail(email);

  if (!account) {
    return null;
  }

  return {
    account,
    client: new Resend(account.apiKey),
  };
}

export function getWebhookSecrets() {
  return getResendAccounts()
    .map((account) => account.webhookSecret)
    .filter((secret): secret is string => Boolean(secret));
}
