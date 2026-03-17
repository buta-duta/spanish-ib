const primary = "#C9A84C"; // warm gold
const primaryLight = "#F0D080";
const primaryDark = "#9A7528";

const accent = "#E8F0FF"; // soft blue-white

const darkBg = "#0F1117";
const darkCard = "#1A1D27";
const darkCardAlt = "#22263A";
const darkBorder = "#2E3250";

export default {
  light: {
    text: "#0F1117",
    textSecondary: "#5A5F7A",
    background: "#F5F6FA",
    card: "#FFFFFF",
    cardAlt: "#EEF0F8",
    border: "#DDE0F0",
    tint: primary,
    tintLight: primaryLight,
    tintDark: primaryDark,
    accent,
    tabIconDefault: "#A0A4B8",
    tabIconSelected: primary,
  },
  dark: {
    text: "#F0F1F8",
    textSecondary: "#8A90B0",
    background: darkBg,
    card: darkCard,
    cardAlt: darkCardAlt,
    border: darkBorder,
    tint: primary,
    tintLight: primaryLight,
    tintDark: primaryDark,
    accent: "#1E2340",
    tabIconDefault: "#5A5F7A",
    tabIconSelected: primary,
  },
};
