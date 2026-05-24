import { normalizeText } from "@/lib/text-normalize";

export type ProfessionCategory = {
  matchers: string[];
  phrases: string[];
  irrelevantTypes?: string[];
};

export const PROFESSION_CATEGORIES: ProfessionCategory[] = [
  {
    matchers: [
      "beauty",
      "salon lepote",
      "kozmeticki",
      "kozmeticki salon",
      "kozmetika",
    ],
    phrases: [
      "kozmetički salon",
      "kozmeticki salon",
      "beauty salon",
      "beauty studio",
      "manikir",
      "pedikir",
      "nokti",
      "depilacija",
      "šminkanje",
      "sminkanje",
      "masaža",
      "masaza",
      "tretmani lica",
      "obrve",
      "trepavice",
    ],
    irrelevantTypes: [
      "car_repair",
      "car_dealer",
      "gas_station",
      "restaurant",
      "hospital",
    ],
  },
  {
    matchers: ["auto servis", "mehanicar", "automehanicar", "servis automobila"],
    phrases: [
      "auto servis",
      "automehaničar",
      "automehanicar",
      "servis automobila",
      "vulkanizer",
      "auto električar",
      "auto elektricar",
      "tehnički pregled",
      "tehnicki pregled",
      "auto delovi",
      "limarija",
      "farbanje automobila",
    ],
    irrelevantTypes: ["beauty_salon", "hair_care", "restaurant", "dentist"],
  },
  {
    matchers: ["stomatolog", "zubar", "stomatoloska", "dental"],
    phrases: [
      "stomatološka ordinacija",
      "stomatoloska ordinacija",
      "zubar",
      "stomatolog",
      "dental clinic",
      "implantolog",
      "ortodoncija",
      "beljenje zuba",
    ],
    irrelevantTypes: ["car_repair", "beauty_salon", "restaurant"],
  },
  {
    matchers: ["restoran", "kafic", "hrana", "picerija", "pizzeria"],
    phrases: [
      "restoran",
      "kafić",
      "kafic",
      "fast food",
      "pizzeria",
      "pekara",
      "poslastičarnica",
      "poslasticarnica",
      "roštilj",
      "rostilj",
      "dostava hrane",
    ],
    irrelevantTypes: ["car_repair", "beauty_salon", "hair_care"],
  },
  {
    matchers: ["namestaj", "nameštaj", "salon namestaja"],
    phrases: [
      "salon nameštaja",
      "salon namestaja",
      "nameštaj",
      "namestaj",
      "kuhinje po meri",
      "stolarska radionica",
      "stolar",
      "izrada nameštaja",
      "izrada namestaja",
    ],
    irrelevantTypes: ["restaurant", "beauty_salon", "car_repair"],
  },
  {
    matchers: ["gradjevina", "gradjevinski", "majstor", "građevina"],
    phrases: [
      "građevinski materijal",
      "gradjevinski materijal",
      "fasade",
      "moler",
      "gipsar",
      "keramicar",
      "keramičar",
      "vodoinstalater",
      "električar",
      "elektricar",
      "parketar",
      "adaptacija stanova",
    ],
    irrelevantTypes: ["beauty_salon", "restaurant", "hair_care"],
  },
  {
    matchers: ["frizer", "barber", "berber"],
    phrases: [
      "frizerski salon",
      "frizer",
      "barber",
      "berber",
      "šišanje",
      "sisanje",
      "farbanje kose",
    ],
    irrelevantTypes: ["car_repair", "restaurant", "dentist"],
  },
  {
    matchers: ["fitness", "teretana", "gym"],
    phrases: [
      "teretana",
      "fitness centar",
      "personalni trener",
      "pilates",
      "yoga",
      "joga",
      "crossfit",
    ],
    irrelevantTypes: ["restaurant", "car_repair", "beauty_salon"],
  },
  {
    matchers: ["vila", "apartman", "smeštaj", "smestaj", "prenociste"],
    phrases: [
      "apartmani",
      "apartman",
      "vila",
      "smeštaj",
      "smestaj",
      "izdavanje apartmana",
      "prenoćište",
      "prenociste",
    ],
    irrelevantTypes: ["car_repair", "beauty_salon", "hair_care"],
  },
];

export function detectCategory(
  normalizedProfession: string
): ProfessionCategory | null {
  for (const category of PROFESSION_CATEGORIES) {
    const matched = category.matchers.some((matcher) => {
      const normalizedMatcher = normalizeText(matcher);
      return (
        normalizedProfession.includes(normalizedMatcher) ||
        normalizedMatcher.includes(normalizedProfession)
      );
    });

    if (matched) {
      return category;
    }
  }

  return null;
}

export function getNearbyKeyword(
  profession: string,
  category: ProfessionCategory | null
): string {
  if (category && category.phrases.length > 0) {
    return category.phrases[0];
  }

  return profession.trim();
}
