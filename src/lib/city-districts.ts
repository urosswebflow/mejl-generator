import { normalizeText } from "@/lib/text-normalize";

/** Opštine / četvrti za proširene text upite (veći gradovi u Srbiji). */
const CITY_DISTRICTS: Record<string, string[]> = {
  beograd: [
    "Novi Beograd",
    "Zemun",
    "Vračar",
    "Voždovac",
    "Zvezdara",
    "Palilula",
    "Čukarica",
    "Rakovica",
    "Stari grad",
    "Savski venac",
    "Mirijevo",
    "Konjarnik",
    "Banovo brdo",
  ],
  "novi sad": [
    "Liman",
    "Detelinara",
    "Grbavica",
    "Petrovaradin",
    "Klisa",
    "Podbara",
    "Rotkvarija",
    "Adamovićevo naselje",
  ],
  nis: [
    "Medijana",
    "Pantelej",
    "Crveni Krst",
    "Palilula",
    "Niška Banja",
    "Centar",
  ],
  kragujevac: [
    "Centar",
    "Aerodrom",
    "Pivara",
    "Grošnica",
    "Stragari",
  ],
  subotica: ["Centar", "Radijalac", "Prozivka", "Kertvaroš"],
  zrenjanin: ["Centar", "Bagljaš", "Mužlja", "Dolovo"],
  cacak: ["Centar", "Ostrog", "Baluga", "Loznica"],
  "pančevo": ["Centar", "Tamiš", "Misa", "Ivanovo"],
  pancevo: ["Centar", "Tamiš", "Misa", "Ivanovo"],
};

export function getDistrictsForCity(city: string): string[] {
  const key = normalizeText(city);
  return CITY_DISTRICTS[key] ? [...CITY_DISTRICTS[key]] : [];
}
