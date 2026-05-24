import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFirstName(owner: string) {
  if (!owner) return "";

  const invalidValues = ["nije pronađen", "nije pronadjen", "n/a", "-", "/"];

  if (invalidValues.includes(owner.toLowerCase())) {
    return "";
  }

  return owner.trim().split(" ")[0] || "";
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY nije pronađen u .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const companyName = cleanValue(body.companyName);
    const profession = cleanValue(body.profession);
    const city = cleanValue(body.city);
    const address = cleanValue(body.address);
    const owner = cleanValue(body.owner);
    const email = cleanValue(body.email);

    const firstName = getFirstName(owner);
    const greeting = firstName ? `Zdravo ${firstName},` : "Zdravo,";

    const businessLabel = profession || "biznis";
    const businessName = companyName || "Vaš biznis";
    const cityName = city || "Vašem gradu";

    const prompt = `
Ti si profesionalni copywriter za prodajne email proposal-e na srpskom jeziku.

Tvoj zadatak je da napišeš SAMO finalni email proposal, bez subjecta, bez markdown-a, bez objašnjenja.

MORAŠ veoma strogo da pratiš strukturu, dužinu, redosled i stil ovog template-a. Nemoj da praviš potpuno novi email. Menjaj samo:
- ime u pozdravu
- delatnost
- grad
- naziv biznisa ako ima smisla
- formulacije koje zavise od delatnosti

OBAVEZNO:
- Email mora početi ovako: ${greeting}
- Nikada ne koristi "Poštovani"
- Ako postoji ime vlasnika, koristi samo prvo ime u pozdravu
- Piši srpski latinicom
- Ton: ljubazan, jasan, profesionalan, ubedljiv, ali nenapadan
- Ne izmišljaj podatke koje nemaš
- Ne spominji da si AI
- Ne koristi bullet karaktere, samo redove kao u template-u
- Nemoj menjati potpis
- Ne piši subject
- Posle pozdrava napravi prazan red, pa tek onda počni sa "Verujem..."
- Deo "Sajt bi sadržao:" mora biti u formi nabrajanja sa crticama.

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
- ako je salon lepote / beauty / kozmetički salon: koristi izraze kao "salon", "beauty usluge", "tretmani", "zakazivanje termina"
- ako je manikir/pedikir: koristi "usluge manikira i pedikira", "termini", "radovi", "cenovnik"
- ako je auto servis: koristi "usluge popravke i održavanja vozila", "servisne usluge", "upiti klijenata", "kontakt"
- ako je restoran/kafić: koristi "gosti", "meni", "rezervacije", "lokacija"
- ako je stomatološka ordinacija: koristi "ordinacija", "stomatološke usluge", "zakazivanje pregleda"
- ako je građevina/usluge/servis/prodaja: prilagodi prirodno toj delatnosti

Ne moraš koristiti baš ove primere ako ne odgovaraju, ali moraš delovati kao da razumeš delatnost.

TEMPLATE KOJI MORAŠ DA ISPRATIŠ:

${greeting}
Verujem da bi Vaš ${businessLabel} uz profesionalan web sajt mogao da dobija više upita i zakazanih termina, posebno od ljudi koji usluge poput Vaših traže preko Google-a, a ne Instagrama.

Pored modernog i profesionalnog izgleda, web sajt bi Vam omogućio da Vas ljudi mnogo lakše pronađu na Google-u, da steknu više poverenja u Vaš ${businessLabel}, da odmah vide sve usluge, cenovnik i rezultate rada, kao i da Vam značajno smanji svakodnevno odgovaranje na ista pitanja i olakša zakazivanje termina ili slanje upita.

Zato bih Vam predložio izradu modernog web sajta koji bi jasno i elegantno predstavio ${businessName} i sve što nudite.

Sajt bi sadržao:
- Moderan i pregledan prikaz svih usluga koje pružate
- Jasno istaknut cenovnik ili ponudu, kako bi klijenti odmah imali sve potrebne informacije
- Profesionalnu galeriju radova, proizvoda, prostora ili rezultata rada
- Recenzije zadovoljnih klijenata koje povećavaju poverenje
- Kontakt stranicu sa svim relevantnim podacima i mapom lokacije u ${cityName}
- Mogućnost online zakazivanja termina ili slanja upita
- Potpunu optimizaciju za mobilne telefone
- SEO optimizaciju, kako bi se Vaš biznis pojavljivao na Google pretragama poput „${businessLabel} ${cityName}“, „${businessName} ${cityName}“ i slično

Sajt bih radio u Webflow-u, platformi koja omogućava izuzetno brze, moderne i stabilne sajtove, sa mnogo boljim performansama od klasičnih WordPress rešenja, a najbolje od svega jeste duplo manja cena izrade.

Ja sam Uroš, završio sam Vojnu akademiju kao diplomirani mašinski inženjer, ali se pored tog posla već više od 3 godine aktivno bavim izradom modernih web sajtova u Webflow-u. Moj portfolio možete pogledati ovde: https://www.urosdev.com

Spreman sam da Vam potpuno besplatno uradim predlog početne strane sajta, kako biste mogli da vidite kako bi Vaš ${businessLabel} mogao da izgleda online pre nego što donesete bilo kakvu odluku.

Ukoliko Vam ideja zvuči zanimljivo, biće mi drago da se čujemo.

Srdačan pozdrav,
Uroš Stanković

Sada napiši finalni email.
Mora da bude veoma sličan template-u iznad, ali prirodno prilagođen delatnosti.
Vrati samo email tekst.
`;

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
              parts: [
                {
                  text: prompt,
                },
              ],
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
      return NextResponse.json(
        {
          error:
            data?.error?.message || "Greška prilikom poziva Gemini API-ja.",
        },
        { status: response.status }
      );
    }

    const proposal =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Gemini nije vratio tekst proposal-a.";

    return NextResponse.json({ proposal });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}