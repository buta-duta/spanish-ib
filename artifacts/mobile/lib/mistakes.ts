import type { MistakeItem } from "@/types/progress";

let mistakeCounter = 0;
function mid(): string {
  mistakeCounter += 1;
  return `mistake-${Date.now()}-${mistakeCounter}`;
}

export function mistakesFromReadingAnswers(
  questions: Array<{ id: string; question: string; answer: string }>,
  answers: Record<string, string>,
): MistakeItem[] {
  const out: MistakeItem[] = [];
  for (const q of questions) {
    const given = (answers[q.id] ?? "").trim().toLowerCase();
    const expected = q.answer.trim().toLowerCase();
    if (!given || given === expected) continue;
    out.push({
      id: mid(),
      category: "comprehension",
      description: `Incorrect answer on: ${q.question.slice(0, 80)}`,
      example: answers[q.id],
      correction: q.answer,
    });
  }
  return out;
}

export function mistakesFromListeningAnswers(
  questions: Array<{ id: string; question: string; correctAnswer: string }>,
  answers: Record<string, { given: string; correct: boolean; feedback?: string }>,
): MistakeItem[] {
  const out: MistakeItem[] = [];
  for (const q of questions) {
    const a = answers[q.id];
    if (!a || a.correct) continue;
    out.push({
      id: mid(),
      category: "listening",
      description: a.feedback || `Wrong on: ${q.question.slice(0, 80)}`,
      example: a.given,
      correction: q.correctAnswer,
    });
  }
  return out;
}

export function mistakesFromWritingFeedback(feedback: {
  areasToImprove?: string[];
  vocabularySuggestions?: Array<{ original?: string; advanced?: string; word?: string; suggestion?: string }>;
  criterionA?: {
    corrections?: Array<{ error?: string; correction?: string; original?: string; corrected?: string }>;
  };
}): MistakeItem[] {
  const out: MistakeItem[] = [];
  for (const area of feedback.areasToImprove ?? []) {
    out.push({ id: mid(), category: "writing", description: area });
  }
  for (const v of feedback.vocabularySuggestions ?? []) {
    const orig = v.original ?? v.word;
    const adv = v.advanced ?? v.suggestion;
    if (orig && adv) {
      out.push({
        id: mid(),
        category: "vocabulary",
        description: `Use "${adv}" for stronger range`,
        example: orig,
        correction: adv,
      });
    }
  }
  for (const c of feedback.criterionA?.corrections ?? []) {
    const err = c.error ?? c.original;
    const fix = c.correction ?? c.corrected;
    if (err) {
      out.push({
        id: mid(),
        category: "grammar",
        description: err,
        correction: fix,
      });
    }
  }
  return out;
}

export function mistakesFromExamFeedback(feedback: {
  languageAnalysis?: {
    grammarMistakes?: Array<{ error: string; correction: string; explanation?: string }>;
  };
  improvementSuggestions?: { vocabulary?: string[]; betterStructures?: string[] };
}): MistakeItem[] {
  const out: MistakeItem[] = [];
  for (const g of feedback.languageAnalysis?.grammarMistakes ?? []) {
    out.push({
      id: mid(),
      category: "grammar",
      description: g.explanation || g.error,
      example: g.error,
      correction: g.correction,
    });
  }
  for (const v of feedback.improvementSuggestions?.vocabulary ?? []) {
    out.push({ id: mid(), category: "vocabulary", description: v });
  }
  for (const s of feedback.improvementSuggestions?.betterStructures ?? []) {
    out.push({ id: mid(), category: "structure", description: s });
  }
  return out;
}

export function mistakesFromImageFeedback(feedback: {
  improvements?: string[];
  grammarTips?: string[];
  vocabularyTips?: string[];
  areasToImprove?: string[];
}): MistakeItem[] {
  const out: MistakeItem[] = [];
  for (const t of feedback.improvements ?? feedback.areasToImprove ?? []) {
    out.push({ id: mid(), category: "oral", description: t });
  }
  for (const t of feedback.grammarTips ?? []) {
    out.push({ id: mid(), category: "grammar", description: t });
  }
  for (const t of feedback.vocabularyTips ?? []) {
    out.push({ id: mid(), category: "vocabulary", description: t });
  }
  return out;
}

export function localSessionSummary(mistakes: MistakeItem[], score?: { correct: number; total: number }): {
  summary: string;
  focusAreas: string[];
} {
  if (mistakes.length === 0) {
    return {
      summary: score
        ? `Strong session: ${score.correct}/${score.total} correct. Keep practising for consistency.`
        : "Strong session. Keep building fluency and range.",
      focusAreas: [],
    };
  }
  const categories = [...new Set(mistakes.map((m) => m.category))];
  const focusAreas = categories.slice(0, 5);
  const summary = `You had ${mistakes.length} area(s) to improve${
    score ? ` (${score.correct}/${score.total} correct)` : ""
  }. Focus next on: ${focusAreas.join(", ")}.`;
  return { summary, focusAreas };
}
