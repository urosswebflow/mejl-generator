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
  } = params;

  return `
Ti si profesionalni copywriter za prodajne email proposal-e na srpskom jeziku.

Tvoj zadatak je da napišeš SAMO finalni email proposal, bez subjecta, bez markdown-a, bez objašnjenja.

Korisnik je uploadovao primer propozala koji treba da posluži kao STYLE GUIDE.
MORAŠ da pratiš strukturu, dužinu, redosled paragrafa, ton i stil tog primera.
NE kopiraj tekst doslovno — personalizuj ga za novu firmu.

OBAVEZNO:
- Email mora početi ovako: ${greeting}
- Nikada ne koristi "Poštovani"
- Ako postoji ime vlasnika, koristi samo prvo ime u pozdravu
- Piši srpski latinicom
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
Adresa: ${address || "Nije poznata"}
Ime za obraćanje: ${firstName || "nije uneto"}
Email: ${email || "nije unet"}

PRIMER PROPOZALA (STYLE GUIDE — prati strukturu i ton):
---
${proposalExampleText}
---

Sada napiši finalni email za novu firmu.
Mora da bude veoma sličan primeru po strukturi i stilu, ali prirodno prilagođen delatnosti i podacima iznad.
Vrati samo email tekst.
`;
}

export function applyNameOnlyTemplate(templateText: string, owner: string) {
  const firstName = getOwnerFirstName(owner);
  return templateText.replaceAll("{ime}", firstName);
}

export type ProposalInput = {
  companyName: string;
  profession: string;
  city: string;
  address: string;
  owner: string;
  email: string;
  proposalExampleText?: string;
  nameOnly?: boolean;
};

export function buildProposalSubject(companyName: string) {
  const name = companyName.trim() || "Vaš biznis";
  return `Predlog saradnje — ${name}`;
}

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

  if (nameOnly && proposalExampleText) {
    return {
      proposal: applyNameOnlyTemplate(proposalExampleText, owner),
      subject: buildProposalSubject(companyName),
    };
  }

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nije pronađen u .env.local.");
  }

  const firstName = getOwnerFirstName(owner);
  const greeting = firstName ? `Zdravo ${firstName},` : "Zdravo,";

  const businessLabel = profession || "biznis";
  const businessName = companyName || "Vaš biznis";
  const cityName = city || "Vašem gradu";

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
    subject: buildProposalSubject(businessName),
  };
}
