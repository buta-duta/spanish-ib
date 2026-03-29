import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

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
  const { theme = "experiencias", textType = "article", customFocus, level = "b" } = req.body as {
    theme?: string;
    textType?: string;
    customFocus?: string;
    level?: "b" | "ab_initio";
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
          content: `You are an expert IB Spanish ${level === "ab_initio" ? "Ab Initio" : "B"} curriculum writer.

CORE MISSION:
Generate an authentic ${typeName} for the IB Spanish ${level === "ab_initio" ? "Ab Initio (A1-A2)" : "B (B1-B2)"} course.

${level === "ab_initio" ? `!!! STRICT AB INITIO CONSTRAINTS !!!
- LEVEL: A1-A2 (Survival Spanish).
- VOCABULARY: Use ONLY the top 500 most common Spanish words. AVOID all specialized, academic, or formal terms. If you use a word like 'gastronomía', you HAVE FAILED. Use 'comida'.
- GRAMMAR: Present Indicative ONLY. NO past tenses. NO subjunctive. NO future.
- STRUCTURE: 5-8 words per sentence. Subject + Verb + Object only.
- LENGTH: 150-200 words max.` : `
- LEVEL: B1-B2.
- VOCABULARY: Intermediate/Advanced IB B vocabulary.
- GRAMMAR: Complex structures (subjunctive, conditional, etc.).
- LENGTH: 400-600 words.`}

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
    res.status(500).json({ error: "Error al generar el texto." });
  }
});

// ── Generate IB-style questions ───────────────────────────────────────────────
router.post("/reading/questions", async (req, res) => {
  const { text, title = "", count = 8, level = "b" } = req.body as { text: string; title?: string; count?: number; level?: "b" | "ab_initio" };
  if (!text || text.length < 50) {
    return res.status(400).json({ error: "Texto demasiado corto." });
  }

  const mcqCount = Math.max(1, Math.round(count * 0.4));
  const tfCount  = Math.max(1, Math.round(count * 0.35));
  const synCount = Math.max(1, count - mcqCount - tfCount);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an IB Spanish ${level === "ab_initio" ? "Ab Initio" : "B"} examiner creating reading comprehension questions.

Given a Spanish text, generate exactly ${count} questions in Spanish that test reading comprehension, inference, and vocabulary.

Mix EXACTLY these question types:
- ${mcqCount} multiple choice (type: "mcq") with options A, B, C, D
- ${tfCount} true/false (type: "tf") with a statement the student evaluates
- ${synCount} synonym (type: "synonym") asking to find a word in the text that means the same as a given word

For MCQ: distractors must be plausible but wrong based on the text.
For T/F: write clear statements that are definitively true or false based on the text.
For Synonym: pick vocabulary words at ${level === "ab_initio" ? "A2 level" : "B2 level"} that appear in the text.
${level === "ab_initio" ? "\nCRITICAL: All questions, multiple-choice options, true/false statements, and instructions MUST be written using extremely simple A1-A2 vocabulary so the Ab Initio student can easily understand exactly what is being asked. Avoid any complex sentence structures or rare words.\n" : ""}
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
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return res.json({ questions: parsed.questions ?? [] });
  } catch (err) {
    console.error("reading/questions error:", err);
    return res.status(500).json({ error: "Error al generar preguntas." });
  }
});

export default router;
