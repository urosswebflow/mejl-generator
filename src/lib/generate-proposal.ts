function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getOwnerFirstName(owner: string) {
  if (!owner) return "";

  const invalidValues = ["nije pronađen", "nije pronadjen", "n/a", "-", "/"];

  if (invalidValues.includes(owner.toLowerCase())) {
    return "";
  }

  return owner.trim().split(" ")[0] || "";
}

export type TemplateLanguage = "en" | "sr";

const ENGLISH_MARKERS =
  /\b(hi|hello|dear|kind regards|best regards|i came|your business|google reviews|would you|i'd be happy|i am|i'm|that's|don't|you're|we're|they're|every day|simply forget|reply to this email)\b/gi;

const SERBIAN_MARKERS =
  /\b(zdravo|poštovani|postovani|srdačan|srdačan pozdrav|vaš|vaše|želite|biste|firma|delatnost|predlog|saradnje|web sajt|beogradu|u beogradu|u nišu|biće mi drago|ukoliko vam|nemate web)\b/gi;

export function detectTemplateLanguage(text: string): TemplateLanguage {
  const sample = text.slice(0, 4000);
  const serbianChars = (sample.match(/[šđčćžŠĐČĆŽ]/g) || []).length;

  if (serbianChars >= 2) {
    return "sr";
  }

  const englishHits = (sample.match(ENGLISH_MARKERS) || []).length;
  const serbianHits = (sample.match(SERBIAN_MARKERS) || []).length;

  if (englishHits > serbianHits) {
    return "en";
  }

  return "sr";
}

export function buildTemplateGreeting(
  firstName: string,
  language: TemplateLanguage
) {
  if (language === "en") {
    return firstName ? `Hi ${firstName},` : "Hi,";
  }

  return firstName ? `Zdravo ${firstName},` : "Zdravo,";
}

function buildDefaultTemplatePrompt(params: {
  greeting: string;
  businessLabel: string;
  businessName: string;
  cityName: string;
  address: string;
  firstName: string;
  email: string;
}) {
  const {
    greeting,
    businessLabel,
    businessName,
    cityName,
    address,
    firstName,
    email,
  } = params;

  return `
Ti si profesionalni copywriter za prodajne email proposal-e na srpskom jeziku.

Tvoj zadatak je da napišeš subject i finalni email proposal, bez markdown-a, bez objašnjenja.

MORAŠ veoma strogo da pratiš strukturu, dužinu, redosled i stil ovog template-a. Nemoj da praviš potpuno novi email. Menjaj samo:
- ime u pozdravu
- delatnost i tip biznisa u celom tekstu
- grad (pravilno sklonjen, npr. u Beogradu, u Nišu)
- naziv biznisa gde ima smisla
- subject prema tipu biznisa

OBAVEZNO:
- Email mora početi ovako: ${greeting}
- Nikada ne koristi "Poštovani"
- Ako postoji ime vlasnika, koristi samo prvo ime u pozdravu
- Piši srpski latinicom
- Ton: ljubazan, jasan, profesionalan, ubedljiv, ali nenapadan
- Ne izmišljaj podatke koje nemaš
- Ne spominji da si AI
- Ne koristi bullet karaktere
- Nemoj menjati potpis
- UVEK uključi rečenicu da biznis trenutno nema web sajt (kao u template-u)
- Posle pozdrava uvek pravi prazan red pre sledećeg pasusa

FORMAT ODGOVORA (strogo):
Linija 1: SUBJECT: Predlog za unapređenje Vašeg [pravilno sklonjen tip biznisa]
Linija 2: prazna
Linija 3+: samo telo emaila (bez subjecta u telu)

Primeri subject-a:
- salon lepote / beauty salon -> Predlog za unapređenje Vašeg salona
- restoran -> Predlog za unapređenje Vašeg restorana
- advokat -> Predlog za unapređenje Vaše advokatske kancelarije
- tattoo studio -> Predlog za unapređenje Vašeg tattoo studija

PODACI ZA PERSONALIZACIJU:
Naziv firme/biznisa: ${businessName}
Delatnost iz pretrage: ${businessLabel}
Grad: ${cityName}
Adresa: ${address || "Nije poznata"}
Ime za obraćanje: ${firstName || "nije uneto"}
Email: ${email || "nije unet"}

VAŽNO ZA DELATNOST:
Na osnovu delatnosti iz pretrage prilagodi izraze u emailu.
Primeri:
- salon lepote / beauty / kozmetički salon: "beauty salone", "salon", "beauty usluge", "tretmani", "zakazivanje termina"
- restoran/kafić: "restorane", "restoran", "gosti", "meni", "rezervacije"
- advokat / advokatska kancelarija: "advokatske kancelarije", "kancelariju", "klijenti", "pravne usluge"
- tattoo studio: "tattoo studije", "studio", "tattoo usluge", "termini"
- auto servis: "servise", "servisne usluge", "upiti klijenata"
- stomatološka ordinacija: "ordinaciju", "stomatološke usluge", "zakazivanje pregleda"
- ostale delatnosti: prilagodi prirodno, ali zadrži isti ton i strukturu

TEMPLATE KOJI MORAŠ DA ISPRATIŠ:

${greeting}

Pretražujući beauty salone u Beogradu, naišao sam na Vaš salon i primetio da trenutno nemate web sajt. Zbog toga verovatno propuštate deo potencijalnih klijenata koji beauty usluge traže preko Google-a, a ne samo preko društvenih mreža.

Moderan web sajt omogućio bi Vam da Vas novi klijenti lakše pronađu, steknu poverenje u Vaš salon, pregledaju usluge, cene i recenzije, kao i da odmah zakažu termin ili pošalju upit. Pored toga, bio bi potpuno prilagođen mobilnim telefonima i optimizovan za Google pretragu.

Sajt izrađujem u Webflow-u, modernoj platformi koja omogućava izuzetno brze, stabilne i profesionalne web sajtove.

Ja sam Uroš. Završio sam Vojnu akademiju kao mašinski inženjer, ali se već više od 3 godine, pored oficirskog poziva, u slobodno vreme bavim izradom modernih web sajtova za male i srednje biznise. Moj portfolio možete pogledati ovde: https://www.urosdev.com

Ako želite, mogu potpuno besplatno da napravim predlog početne strane Vašeg sajta, kako biste videli kako bi Vaš salon mogao da izgleda online pre nego što donesete bilo kakvu odluku.

Ukoliko Vam ideja zvuči zanimljivo, biće mi drago da se čujemo.

Srdačan pozdrav,
Uroš Stanković

Sada napiši subject i finalni email.
Mora da bude veoma sličan template-u iznad, ali prirodno prilagođen delatnosti, gradu i imenu.
`;
}

function parseDefaultGeminiResponse(raw: string, profession: string) {
  const trimmed = raw.trim();
  const match = trimmed.match(/^SUBJECT:\s*(.+)\n\s*\n([\s\S]+)$/);

  if (match) {
    return {
      subject: match[1].trim(),
      proposal: match[2].trim(),
    };
  }

  return {
    subject: buildDefaultProposalSubject(profession),
    proposal: trimmed,
  };
}

export function buildDefaultProposalSubject(profession: string) {
  const label = profession.trim() || "biznisa";
  return `Predlog za unapređenje Vašeg ${label}`;
}

function buildStyleGuidePrompt(params: {
  greeting: string;
  businessLabel: string;
  businessName: string;
  cityName: string;
  address: string;
  firstName: string;
  email: string;
  proposalExampleText: string;
  language: TemplateLanguage;
}) {
  const {
    greeting,
    businessLabel,
    businessName,
    cityName,
    address,
    firstName,
    email,
    proposalExampleText,
    language,
  } = params;

  const isEnglish = language === "en";
  const unknownAddress = isEnglish ? "Unknown" : "Nije poznata";
  const unknownName = isEnglish ? "not provided" : "nije uneto";
  const unknownEmail = isEnglish ? "not provided" : "nije unet";

  return isEnglish
    ? `
You are a professional copywriter for sales email proposals in English.

Your task is to write ONLY the final email proposal body, without subject, markdown, or explanations.

The user uploaded a proposal example to use as a STYLE GUIDE.
You MUST follow the structure, length, paragraph order, tone, and style of that example.
Do NOT copy the text verbatim — personalize it for the new business.

MANDATORY:
- The email must start exactly like this: ${greeting}
- If an owner name exists, use only the first name in the greeting
- Write in English only. Use the SAME language as the style guide example. Do NOT translate to Serbian or any other language.
- Tone: friendly, clear, professional, persuasive, but not pushy
- Do not invent data you do not have
- Do not mention that you are AI
- Do not write a subject line
- Keep the same list/formatting style as in the example (bullets or line breaks, as uploaded)
- Keep the signature and contact details from the example if present

PERSONALIZATION DATA:
Business name: ${businessName}
Search category: ${businessLabel}
City: ${cityName}
Address: ${address || unknownAddress}
Name for greeting: ${firstName || unknownName}
Email: ${email || unknownEmail}

PROPOSAL EXAMPLE (STYLE GUIDE — follow structure and tone):
---
${proposalExampleText}
---

Now write the final email for the new business.
It must be very similar to the example in structure and style, but naturally adapted to the business and data above.
Return only the email body text.
`
    : `
Ti si profesionalni copywriter za prodajne email proposal-e na srpskom jeziku.

Tvoj zadatak je da napišeš SAMO finalni email proposal, bez subjecta, bez markdown-a, bez objašnjenja.

Korisnik je uploadovao primer propozala koji treba da posluži kao STYLE GUIDE.
MORAŠ da pratiš strukturu, dužinu, redosled paragrafa, ton i stil tog primera.
NE kopiraj tekst doslovno — personalizuj ga za novu firmu.

OBAVEZNO:
- Email mora početi ovako: ${greeting}
- Nikada ne koristi "Poštovani"
- Ako postoji ime vlasnika, koristi samo prvo ime u pozdravu
- Piši srpski latinicom. Koristi ISTI jezik kao primer. Ne prevodi na engleski niti na drugi jezik.
- Ton: ljubazan, jasan, profesionalan, ubedljiv, ali nenapadan
- Ne izmišljaj podatke koje nemaš
- Ne spominji da si AI
- Ne piši subject
- Zadrži isti format nabrajanja kao u primeru (crtice ili redovi, kako je u uploadu)
- Zadrži potpis i kontakt podatke iz primera ako postoje

PODACI ZA PERSONALIZACIJU:
Naziv firme/biznisa: ${businessName}
Delatnost iz pretrage: ${businessLabel}
Grad: ${cityName}
Adresa: ${address || unknownAddress}
Ime za obraćanje: ${firstName || unknownName}
Email: ${email || unknownEmail}

PRIMER PROPOZALA (STYLE GUIDE — prati strukturu i ton):
---
${proposalExampleText}
---

Sada napiši finalni email za novu firmu.
Mora da bude veoma sličan primeru po strukturi i stilu, ali prirodno prilagođen delatnosti i podacima iznad.
Vrati samo email tekst.
`;
}

export const TEMPLATE_PLACEHOLDERS = [
  "{ime}",
  "{naziv_firme}",
  "{broj_recenzija}",
  "{prosecna_ocena}",
  "{delatnost}",
] as const;

export function templateHasPlaceholder(content: string) {
  return TEMPLATE_PLACEHOLDERS.some((placeholder) =>
    content.includes(placeholder)
  );
}

export type PlaceholderValues = {
  owner: string;
  companyName: string;
  reviews?: number;
  rating?: number | null;
  profession: string;
};

export function applyPlaceholderTemplate(
  templateText: string,
  values: PlaceholderValues
) {
  const firstName = getOwnerFirstName(values.owner);
  const companyName = values.companyName.trim();
  const reviews = values.reviews ?? 0;
  const rating =
    values.rating != null && Number.isFinite(values.rating)
      ? String(values.rating)
      : "—";
  const profession = values.profession.trim() || "business";

  let text = templateText
    .replaceAll("{ime}", firstName)
    .replaceAll("{naziv_firme}", companyName)
    .replaceAll("{broj_recenzija}", String(reviews))
    .replaceAll("{prosecna_ocena}", rating)
    .replaceAll("{delatnost}", profession);

  if (!firstName) {
    text = text.replace(/Hi\s+,/gi, "Hi,");
    text = text.replace(/Zdravo\s+,/gi, "Zdravo,");
  }

  return text;
}

export function buildProposalSubject(
  companyName: string,
  language: TemplateLanguage = "sr"
) {
  const name =
    companyName.trim() ||
    (language === "en" ? "your business" : "Vaš biznis");

  if (language === "en") {
    return `Partnership proposal — ${name}`;
  }

  return `Predlog saradnje — ${name}`;
}

export function resolveTemplateSubject(
  templateSubject: string | undefined,
  companyName: string,
  values: PlaceholderValues,
  language: TemplateLanguage = "sr"
) {
  const custom = cleanValue(templateSubject);

  if (!custom) {
    return buildProposalSubject(companyName, language);
  }

  return applyPlaceholderTemplate(custom, values);
}

export type ProposalInput = {
  companyName: string;
  profession: string;
  city: string;
  address: string;
  owner: string;
  email: string;
  reviews?: number;
  rating?: number | null;
  proposalExampleText?: string;
  templateSubject?: string;
  nameOnly?: boolean;
};

export async function generateProposalText(
  input: ProposalInput,
  apiKey: string
) {
  const companyName = cleanValue(input.companyName);
  const profession = cleanValue(input.profession);
  const city = cleanValue(input.city);
  const address = cleanValue(input.address);
  const owner = cleanValue(input.owner);
  const email = cleanValue(input.email);
  const proposalExampleText = cleanValue(input.proposalExampleText);
  const nameOnly = input.nameOnly === true;
  const usesDefaultTemplate = !proposalExampleText;
  const placeholderValues: PlaceholderValues = {
    owner,
    companyName,
    reviews: input.reviews,
    rating: input.rating,
    profession,
  };

  if (nameOnly && proposalExampleText) {
    const language = detectTemplateLanguage(proposalExampleText);

    return {
      proposal: applyPlaceholderTemplate(proposalExampleText, placeholderValues),
      subject: resolveTemplateSubject(
        input.templateSubject,
        companyName,
        placeholderValues,
        language
      ),
    };
  }

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nije pronađen u .env.local.");
  }

  const firstName = getOwnerFirstName(owner);
  const templateLanguage = proposalExampleText
    ? detectTemplateLanguage(proposalExampleText)
    : "sr";
  const greeting = buildTemplateGreeting(firstName, templateLanguage);

  const businessLabel = profession || (templateLanguage === "en" ? "business" : "biznis");
  const businessName = companyName || (templateLanguage === "en" ? "your business" : "Vaš biznis");
  const cityName = city || (templateLanguage === "en" ? "your city" : "Vašem gradu");

  const promptParams = {
    greeting,
    businessLabel,
    businessName,
    cityName,
    address,
    firstName,
    email,
  };

  const prompt = proposalExampleText
    ? buildStyleGuidePrompt({
        ...promptParams,
        proposalExampleText,
        language: templateLanguage,
      })
    : buildDefaultTemplatePrompt(promptParams);

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1400,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Greška prilikom poziva Gemini API-ja."
    );
  }

  const rawProposal =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Gemini nije vratio tekst proposal-a.";

  if (usesDefaultTemplate) {
    const parsed = parseDefaultGeminiResponse(rawProposal, businessLabel);

    return {
      proposal: parsed.proposal,
      subject: parsed.subject,
    };
  }

  return {
    proposal: rawProposal.trim(),
    subject: resolveTemplateSubject(
      input.templateSubject,
      businessName,
      placeholderValues,
      templateLanguage
    ),
  };
}
