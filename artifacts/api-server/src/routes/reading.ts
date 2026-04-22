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
    res.status(500).json({ error: "Error al generar el texto." });
  }
});

// ── Generate IB-style questions ───────────────────────────────────────────────
router.post("/reading/questions", async (req, res) => {
  const { text, title = "", count = 8 } = req.body as { text: string; title?: string; count?: number };
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
          content: `You are an IB Spanish B examiner creating reading comprehension questions.

Given a Spanish text, generate exactly ${count} questions in Spanish that test reading comprehension, inference, and vocabulary.

Mix EXACTLY these question types:
- ${mcqCount} multiple choice (type: "mcq") with options A, B, C, D
- ${tfCount} true/false (type: "tf") with a statement the student evaluates
- ${synCount} synonym (type: "synonym") asking to find a word in the text that means the same as a given word

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
    return res.status(500).json({ error: "Error al generar preguntas." });
  }
});

export default router;
