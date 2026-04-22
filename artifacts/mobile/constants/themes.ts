export type Theme = {
  id: string;
  name: string;
  nameShort: string;
  description: string;
  color: string;
  colorDark: string;
  iconName: string;
  keywords: string[];
};

export const THEMES: Theme[] = [
  {
    id: "identidades",
    name: "Identidades",
    nameShort: "Identidades",
    description: "Creencias personales, relaciones, identidad cultural y social",
    color: "#7B6FD4",
    colorDark: "#5A4FAB",
    iconName: "person-circle-outline",
    keywords: ["identidad", "cultura", "familia", "tradiciones", "valores"],
  },
  {
    id: "experiencias",
    name: "Experiencias",
    nameShort: "Experiencias",
    description: "Viajes, recuerdos, eventos de vida y momentos transformadores",
    color: "#E8884A",
    colorDark: "#C06030",
    iconName: "airplane-outline",
    keywords: ["viajes", "aventura", "recuerdos", "intercambio", "crecimiento"],
  },
  {
    id: "ingenio-humano",
    name: "Ingenio humano",
    nameShort: "Ingenio humano",
    description: "Tecnología, innovación, medios de comunicación y creatividad",
    color: "#4AABE8",
    colorDark: "#2880C0",
    iconName: "bulb-outline",
    keywords: ["tecnología", "innovación", "arte", "ciencia", "creatividad"],
  },
  {
    id: "organizacion-social",
    name: "Organización social",
    nameShort: "Org. social",
    description: "Educación, leyes, sistemas sociales y responsabilidad cívica",
    color: "#52C97A",
    colorDark: "#2FA050",
    iconName: "people-outline",
    keywords: ["educación", "justicia", "democracia", "comunidad", "sociedad"],
  },
  {
    id: "compartir-el-planeta",
    name: "Compartir el planeta",
    nameShort: "El planeta",
    description: "Medio ambiente, sostenibilidad y problemas globales",
    color: "#C9A84C",
    colorDark: "#9A7528",
    iconName: "earth-outline",
    keywords: ["medioambiente", "sostenibilidad", "clima", "biodiversidad"],
  },
];

export const THEME_STORAGE_KEY = "@ib_exam_used_themes";
export const SESSION_STORAGE_KEY = "@ib_exam_sessions";

export function getThemeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}
