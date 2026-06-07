import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { sendOpenAIError } from "./openaiError";
import { paperSchemaInstructions, gradePromptFor, type AiGradeItem } from "../lib/paper";

const router: IRouter = Router();

const THEME_NAMES: Record<string, string> = {
  identidades: "Identidades",
  experiencias: "Experiencias",
  "ingenio-humano": "Ingenio humano",
  "organizacion-social": "Organización social",
  "compartir-el-planeta": "Compartir el planeta",
};

const TEXT_TYPE_NAMES: Record<string, string> = {
  article: "artículo periodístico",
  blog: "entrada de blog",
  interview: "entrevista",
  email: "correo electrónico formal",
  report: "informe",
};

// ── Generate reading passage ──────────────────────────────────────────────────
router.post("/reading/generate", async (req, res) => {
  const { theme = "experiencias", textType = "article", customFocus } = req.body as {
    theme?: string;
    textType?: string;
    customFocus?: string;
  };

  const themeName = THEME_NAMES[theme] ?? theme;
  const typeName = TEXT_TYPE_NAMES[textType] ?? textType;
  const focusLine = customFocus?.trim()
    ? `\n- Custom focus: Naturally incorporate the following into the text: "${customFocus.trim()}"`
    : "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert IB Spanish B curriculum writer.

CORE MISSION:
Generate an authentic ${typeName} for the IB Spanish B (B1-B2) course.

!!! IB CRITERION A - SPANISH B (TOPIC VOCABULARY) !!!
- LEVEL: B1-B2.
- TOPIC VOCABULARY: Use specific, advanced vocabulary related to ${themeName}. 
- VARIETY: Use a wide range of idiomatic expressions and complex structures.

REQUIREMENTS:
- Theme: ${themeName}
- Include a clear, simple title
- Paragraphs: 3–4
- Authenticity: Style must match a real ${typeName}${focusLine}

FORMAT:
Return a JSON object:
{
  "title": "...",
  "text": "..."
}`,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    res.json({
      title: parsed.title ?? "Texto de lectura",
      text: parsed.text ?? "",
      theme,
      textType,
    });
  } catch (err) {
    console.error("reading/generate error:", err);
    return sendOpenAIError(res, err, "Error al generar el texto.");
  }
});

// ── Generate IB-style questions ───────────────────────────────────────────────
router.post("/reading/questions", async (req, res) => {
  const { text, title = "", count = 8, focusTypes, flashcardWords } = req.body as {
    text: string;
    title?: string;
    count?: number;
    focusTypes?: ("mcq" | "tf" | "synonym")[];
    flashcardWords?: string[];
  };
  if (!text || text.length < 50) {
    return res.status(400).json({ error: "Texto demasiado corto." });
  }

  const allowed = focusTypes?.length ? [...new Set(focusTypes)] : ["mcq", "tf", "synonym"] as const;
  const perType = Math.max(1, Math.floor(count / allowed.length));
  const typeLines = allowed.map((t) => {
    if (t === "mcq") return `- ${perType} multiple choice (type: "mcq") with options A, B, C, D`;
    if (t === "tf") return `- ${perType} true/false (type: "tf") with a statement the student evaluates`;
    return `- ${perType} synonym (type: "synonym") asking to find a word in the text`;
  }).join("\n");
  const vocabLine = flashcardWords?.length
    ? `\nWhere natural, weave in or test these saved vocabulary words: ${flashcardWords.slice(0, 20).join(", ")}.`
    : "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an IB Spanish B examiner creating reading comprehension questions.

Given a Spanish text, generate exactly ${count} questions in Spanish that test reading comprehension, inference, and vocabulary.

Use ONLY these question types (IB-style quick practice):
${typeLines}
${vocabLine}

For MCQ: distractors must be plausible but wrong based on the text.
For T/F: write clear statements that are definitively true or false based on the text.
For Synonym: pick vocabulary words at B2 level that appear in the text.
Return a JSON object:
{
  "questions": [
    {
      "type": "mcq",
      "id": 1,
      "question": "¿Qué afirma el texto sobre...?",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "English explanation of why this is correct, citing the text.",
      "textReference": "Exact quote from the text that supports the answer."
    },
    {
      "type": "tf",
      "id": 2,
      "question": "¿Verdadero o Falso?",
      "statement": "The statement to evaluate...",
      "answer": "Verdadero",
      "explanation": "English explanation.",
      "textReference": "Exact quote from the text."
    },
    {
      "type": "synonym",
      "id": 3,
      "question": "Encuentra en el texto una palabra que signifique lo mismo que...",
      "targetWord": "word to find synonym for",
      "givenWord": "the word you're providing (in English or Spanish) that they need to find the synonym of",
      "answer": "exact word from the text",
      "explanation": "English explanation.",
      "textReference": "Sentence from text containing the word."
    }
  ]
}

Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Text title: ${title}\n\nText:\n${text}`,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return res.json({ questions: parsed.questions ?? [] });
  } catch (err) {
    console.error("reading/questions error:", err);
    return sendOpenAIError(res, err, "Error al generar preguntas.");
  }
});

// ── Full IB exam paper: 3 texts (Texto A/B/C) with mixed question blocks ───────
router.post("/reading/paper", async (req, res) => {
  const { theme = "experiencias", customFocus } = req.body as {
    theme?: string;
    customFocus?: string;
  };
  const themeName = THEME_NAMES[theme] ?? theme;
  const focusLine = customFocus?.trim()
    ? `\n- Enfoque: incorpora de forma natural "${customFocus.trim()}"`
    : "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un examinador del IB Spanish B (Prueba 2, Comprensión de lectura). Crea un examen completo de lectura con TRES textos auténticos y distintos (Texto A, B, C), cada uno con sus propios bloques de preguntas, imitando un examen real.

Nivel: B1-B2. Tema general orientativo: "${themeName}".${focusLine}
- Texto A: ~250-350 palabras (informativo).
- Texto B: ~300-400 palabras (artículo/entrevista).
- Texto C: ~350-450 palabras (reportaje/opinión, con líneas numeradas implícitas para referentes).
- Cada texto debe tener 2-4 bloques de tipos DISTINTOS.

${paperSchemaInstructions("reading")}`,
        },
        { role: "user", content: `Genera el examen de lectura sobre "${themeName}".` },
      ],
      temperature: 0.6,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return res.json({ texts: parsed.texts ?? [] });
  } catch (err) {
    console.error("reading/paper error:", err);
    return sendOpenAIError(res, err, "Error al generar el examen de lectura.");
  }
});

// ── Batch grade free-text answers ─────────────────────────────────────────────
router.post("/reading/grade", async (req, res) => {
  const { items } = req.body as { items: AiGradeItem[] };
  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ results: [] });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: gradePromptFor("reading") },
        { role: "user", content: JSON.stringify({ items }) },
      ],
      temperature: 0.1,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return res.json({ results: parsed.results ?? [] });
  } catch (err) {
    console.error("reading/grade error:", err);
    return sendOpenAIError(res, err, "Error al corregir las respuestas.");
  }
});

export default router;
