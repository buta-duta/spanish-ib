import type { BlockType } from "@/lib/paper";
import type { ModuleId, SessionSummary } from "@/types/progress";

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  "short-answer": "Short answer",
  "multiple-choice": "Multiple choice",
  "gap-fill-bank": "Gap fill (word bank)",
  "heading-match": "Heading match",
  "find-word": "Find word",
  "sentence-completion": "Sentence completion",
  "choose-5-true": "Choose 5 true",
  "true-false-justify": "True / false + justify",
  referent: "Referent",
  "cloze-max3": "Cloze (max 3 words)",
};

const BLOCK_TO_READING: Record<BlockType, "mcq" | "tf" | "synonym"> = {
  "multiple-choice": "mcq",
  "choose-5-true": "mcq",
  "heading-match": "mcq",
  "short-answer": "mcq",
  "sentence-completion": "mcq",
  "cloze-max3": "mcq",
  "true-false-justify": "tf",
  "find-word": "synonym",
  "gap-fill-bank": "synonym",
  referent: "synonym",
};

const BLOCK_TO_LISTENING: Record<BlockType, string> = {
  "multiple-choice": "multiple-choice",
  "choose-5-true": "multiple-choice",
  "heading-match": "multiple-choice",
  "true-false-justify": "true-false",
  "short-answer": "short-answer",
  "sentence-completion": "short-answer",
  "cloze-max3": "short-answer",
  "find-word": "detail",
  "gap-fill-bank": "detail",
  referent: "inference",
};

export function getLastFullPaperMissedTypes(
  summaries: SessionSummary[],
  module: ModuleId,
): BlockType[] {
  const lastFull = summaries.find((s) => s.module === module && s.mode === "full");
  if (!lastFull) return [];
  const types = new Set<BlockType>();
  for (const m of lastFull.mistakes) {
    if (m.questionType) types.add(m.questionType as BlockType);
  }
  return [...types];
}

export function blockTypesToReadingFocus(types: BlockType[]): ("mcq" | "tf" | "synonym")[] {
  const out = new Set<"mcq" | "tf" | "synonym">();
  for (const t of types) out.add(BLOCK_TO_READING[t]);
  return [...out];
}

export function blockTypesToListeningFocus(types: BlockType[]): string[] {
  const out = new Set<string>();
  for (const t of types) out.add(BLOCK_TO_LISTENING[t]);
  return [...out];
}

export function buildWeakCustomFocus(
  weakPractice: boolean,
  weakLabels: string[],
  userFocus: string,
  includeFlashcards: boolean,
  flashcardWords: string[],
): string | undefined {
  const parts: string[] = [];
  if (userFocus.trim()) parts.push(userFocus.trim());
  if (weakPractice && weakLabels.length) parts.push(`Focus on: ${weakLabels.join(", ")}`);
  if (weakPractice && includeFlashcards && flashcardWords.length) {
    parts.push(`Naturally incorporate these saved vocabulary words: ${flashcardWords.slice(0, 24).join(", ")}`);
  }
  return parts.length ? parts.join(". ") : undefined;
}

export function formatMissedTypeLabels(types: BlockType[]): string {
  return types.map((t) => BLOCK_TYPE_LABELS[t]).join(", ");
}
