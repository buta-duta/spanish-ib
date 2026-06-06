// Frontend mirror of the shared IB paper model + answer-state and grading helpers.
import type { MistakeItem } from "@/types/progress";

export type BlockType =
  | "short-answer"
  | "multiple-choice"
  | "gap-fill-bank"
  | "heading-match"
  | "find-word"
  | "sentence-completion"
  | "choose-5-true"
  | "true-false-justify"
  | "referent"
  | "cloze-max3";

export type BankOption = { letter: string; text: string };

export type QuestionItem = {
  id: string;
  question?: string;
  options?: string[];
  clue?: string;
  stem?: string;
  statement?: string;
  phrase?: string;
  answer: string;
  justification?: string;
  explanation?: string;
};

export type QuestionBlock = {
  type: BlockType;
  instruction: string;
  intro?: string;
  options?: BankOption[];
  answers?: string[];
  items?: QuestionItem[];
};

export type PaperText = {
  id: string;
  label: string;
  title: string;
  context?: string;
  body: string;
  blocks: QuestionBlock[];
};

export type Paper = { texts: PaperText[] };

export const AI_GRADED_TYPES: BlockType[] = [
  "short-answer",
  "find-word",
  "sentence-completion",
  "referent",
  "cloze-max3",
];

// Per-field result after grading
export type FieldResult = { correct: boolean; feedback?: string };
export type GradeMap = Record<string, FieldResult>;

// ── Answer-state field ids ────────────────────────────────────────────────────
// choose-5-true: one CSV field keyed by `${blockKey}` storing selected letters.
// true-false-justify: two fields `${item.id}:tf` and `${item.id}:just`.
export const tfField = (id: string) => `${id}:tf`;
export const justField = (id: string) => `${id}:just`;

// ── Collect free-text fields that must be AI-graded ───────────────────────────
export type AiGradeRequestItem = {
  id: string;
  type: BlockType | "justification";
  prompt: string;
  studentAnswer: string;
  expectedAnswer: string;
};

export function collectAiGradeItems(paper: Paper, answers: Record<string, string>): AiGradeRequestItem[] {
  const out: AiGradeRequestItem[] = [];
  for (const text of paper.texts) {
    for (const block of text.blocks) {
      if (AI_GRADED_TYPES.includes(block.type)) {
        for (const it of block.items ?? []) {
          out.push({
            id: it.id,
            type: block.type,
            prompt: it.question ?? it.clue ?? it.stem ?? it.phrase ?? block.instruction,
            studentAnswer: (answers[it.id] ?? "").trim(),
            expectedAnswer: it.answer,
          });
        }
      }
      if (block.type === "true-false-justify") {
        for (const it of block.items ?? []) {
          out.push({
            id: justField(it.id),
            type: "justification",
            prompt: `Justifica: "${it.statement ?? ""}"`,
            studentAnswer: (answers[justField(it.id)] ?? "").trim(),
            expectedAnswer: it.justification ?? "",
          });
        }
      }
    }
  }
  return out;
}

const norm = (s: string) =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¿¡"'()]/g, "")
    .replace(/\s+/g, " ");

// First letter (A/B/C/D) from an answer string like "A" or "A. texto"
const letterOf = (s: string) => (s ?? "").trim().charAt(0).toUpperCase();

// ── Grade objective fields client-side, merge in AI results ───────────────────
export function gradePaper(
  paper: Paper,
  answers: Record<string, string>,
  aiResults: Record<string, FieldResult>,
): { grades: GradeMap; correct: number; total: number } {
  const grades: GradeMap = {};
  let correct = 0;
  let total = 0;

  const award = (key: string, isCorrect: boolean, feedback?: string) => {
    grades[key] = { correct: isCorrect, feedback };
    total += 1;
    if (isCorrect) correct += 1;
  };

  for (const text of paper.texts) {
    for (const block of text.blocks) {
      switch (block.type) {
        case "multiple-choice":
        case "heading-match":
        case "gap-fill-bank": {
          for (const it of block.items ?? []) {
            const given = letterOf(answers[it.id] ?? "");
            award(it.id, !!given && given === letterOf(it.answer));
          }
          break;
        }
        case "choose-5-true": {
          const selected = (answers[blockKey(text.id, block)] ?? "")
            .split(",")
            .map((x) => x.trim().toUpperCase())
            .filter(Boolean);
          const correctSet = new Set((block.answers ?? []).map((x) => x.toUpperCase()));
          // 1 point per correct selection (max = number of correct answers)
          for (const letter of block.answers ?? []) {
            const key = `${blockKey(text.id, block)}:${letter}`;
            award(key, selected.includes(letter.toUpperCase()));
          }
          // store derived per-letter correctness for review handled by UI via correctSet
          void correctSet;
          break;
        }
        case "true-false-justify": {
          for (const it of block.items ?? []) {
            const tf = (answers[tfField(it.id)] ?? "").trim();
            const tfOk = !!tf && norm(tf) === norm(it.answer);
            const justRes = aiResults[justField(it.id)];
            const justOk = !!justRes?.correct;
            // both parts required for the single point
            award(it.id, tfOk && justOk, justRes?.feedback);
          }
          break;
        }
        case "short-answer":
        case "find-word":
        case "sentence-completion":
        case "referent":
        case "cloze-max3": {
          for (const it of block.items ?? []) {
            const ai = aiResults[it.id];
            const given = (answers[it.id] ?? "").trim();
            // empty => incorrect; otherwise trust AI, falling back to exact match
            const isCorrect = !given ? false : ai ? ai.correct : norm(given) === norm(it.answer);
            award(it.id, isCorrect, ai?.feedback);
          }
          break;
        }
      }
    }
  }

  return { grades, correct, total };
}

// Stable key for a block within a text (blocks have no id of their own)
export function blockKey(textId: string, block: QuestionBlock): string {
  const firstItem = block.items?.[0]?.id ?? block.type;
  return `${textId}-${block.type}-${firstItem}`;
}

// ── Build weak-area mistakes from a graded paper ──────────────────────────────
let counter = 0;
const mid = () => {
  counter += 1;
  return `mistake-${Date.now()}-${counter}`;
};

const TYPE_SKILL_TAG: Record<BlockType, string> = {
  "short-answer": "detalle",
  "multiple-choice": "comprension_global",
  "gap-fill-bank": "vocabulario",
  "heading-match": "idea_principal",
  "find-word": "vocabulario",
  "sentence-completion": "detalle",
  "choose-5-true": "comprension_global",
  "true-false-justify": "justificacion",
  referent: "referencia",
  "cloze-max3": "detalle",
};

export function mistakesFromPaper(
  paper: Paper,
  answers: Record<string, string>,
  grades: GradeMap,
  skill: "listening" | "reading",
): MistakeItem[] {
  const out: MistakeItem[] = [];
  const skillWord = skill === "listening" ? "misheard" : "misread";
  const baseCategory = skill === "listening" ? "listening" : "comprehension";

  for (const text of paper.texts) {
    for (const block of text.blocks) {
      const tag = TYPE_SKILL_TAG[block.type];
      if (block.type === "choose-5-true") {
        for (const letter of block.answers ?? []) {
          const key = `${blockKey(text.id, block)}:${letter}`;
          const g = grades[key];
          if (g && !g.correct) {
            const opt = (block.options ?? []).find((o) => o.letter === letter);
            out.push({
              id: mid(),
              category: `${baseCategory}_${tag}`,
              description: `${skillWord} (${text.label}): no marcaste la frase verdadera "${opt?.text ?? letter}"`,
              correction: opt?.text ?? letter,
            });
          }
        }
        continue;
      }
      for (const it of block.items ?? []) {
        const g = grades[it.id];
        if (!g || g.correct) continue;
        const promptText = it.question ?? it.clue ?? it.stem ?? it.statement ?? it.phrase ?? block.instruction;
        out.push({
          id: mid(),
          category: `${baseCategory}_${tag}`,
          description: `${skillWord} (${text.label}): ${String(promptText).slice(0, 90)}`,
          example: answers[it.id] || (answers[tfField(it.id)] ?? ""),
          correction: it.answer + (it.justification ? ` — ${it.justification}` : ""),
        });
      }
    }
  }
  return out;
}
