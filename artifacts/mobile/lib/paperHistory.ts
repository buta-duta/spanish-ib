import type { Paper } from "@/lib/paper";

export type PaperModule = "reading" | "listening";

export function extractPaperTopics(paper: Paper): string[] {
  return paper.texts.map((t) => `${t.label}: ${t.title}`.trim()).filter(Boolean);
}

export function appendPaperTopics(existing: string[], topics: string[], max = 12): string[] {
  const next = [...existing];
  for (const t of topics) {
    if (!t || next.includes(t)) continue;
    next.push(t);
  }
  return next.slice(-max);
}

export function previousTopicsLine(topics: string[]): string {
  if (!topics.length) return "";
  return `\n\nNO repitas estos casos/títulos de exámenes anteriores — crea contenido completamente diferente:\n${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
}
