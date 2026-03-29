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
  email_formal: "correo electrónico formal",
  email_informal: "correo electrónico informal",
  report: "informe",
  review: "reseña",
  speech: "discurso",
};

// ── Generate writing prompt ───────────────────────────────────────────────────
router.post("/writing/prompt", async (req, res) => {
  const { theme = "experiencias", textType = "article", previousPrompts = [], level = "b" } = req.body as {
    theme?: string;
    textType?: string;
    previousPrompts?: string[];
    level?: "b" | "ab_initio";
  };

  const themeName = THEME_NAMES[theme] ?? theme;
  const typeName = TEXT_TYPE_NAMES[textType] ?? textType;
  const avoidSection =
    previousPrompts.length > 0
      ? `\n\nDo NOT use these previous prompts:\n${previousPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un examinador experto del IB Spanish ${level === "ab_initio" ? "Ab Initio" : "B"}.

OBJETIVO:
Generar una tarea de escritura realista al estilo IB.

${level === "ab_initio" ? `!!! RESTRICCIONES ESTRICTAS PARA AB INITIO !!!
- NIVEL: A1-A2 (Español de supervivencia).
- VOCABULARIO: Use SOLAMENTE las 500 palabras más comunes. Evite términos académicos o complejos.
- INSTRUCCIONES: Escriba las instrucciones en un español EXTREMADAMENTE SENCILLO que un principiante pueda entender.
- LARGO: Entre 70 y 150 palabras.` : `
- NIVEL: B1-B2.
- VOCABULARIO: Académico/Intermedio.
- LARGO: Entre 250 y 400 palabras.`}

REQUISITOS:
- Tarea: Escribir un/a ${typeName}
- Tema: ${themeName}
- Situación: Realista, con propósito y audiencia clara.${avoidSection}

Devuelve ÚNICAMENTE el texto de la pregunta en español.`,
        },
      ],
      temperature: 0.8,
      max_completion_tokens: 500,
    });

    const prompt = completion.choices[0]?.message?.content?.trim() ?? "";
    return res.json({ prompt });
  } catch (err) {
    console.error("writing/prompt error:", err);
    return res.status(500).json({ error: "Error al generar la pregunta." });
  }
});

// ── Evaluate writing + IB markscheme feedback ─────────────────────────────────
router.post("/writing/feedback", async (req, res) => {
  const { prompt, essay, theme, textType, level = "b" } = req.body as {
    prompt: string;
    essay: string;
    theme?: string;
    textType?: string;
    level?: "b" | "ab_initio";
  };

  if (!essay || essay.trim().length < 30) {
    return res.status(400).json({ error: "Texto demasiado corto." });
  }

  const themeName = THEME_NAMES[theme ?? ""] ?? theme ?? "general";
  const typeName = TEXT_TYPE_NAMES[textType ?? ""] ?? textType ?? "text";

  try {
    const isAbInitio = level === "ab_initio";
    const criteriaText = isAbInitio
      ? `IB Markscheme criteria (Total 30 marks):
- Criterion A: Language (0-12 marks) — grammar accuracy, tense usage, vocabulary range
- Criterion B: Message (0-12 marks) — clarity, development of ideas, coherence
- Criterion C: Conceptual understanding (0-6 marks) — relevance to theme, appropriateness to text type

IB Band descriptors (approximate for Ab Initio):
- 1-2: Very limited, many errors
- 3-5: Basic, some errors, limited development
- 6-8: Adequate, mostly accurate
- 9-10: Good, accurate, well-organized
- 11-12: Very good, accurate, varied vocabulary

Convert total mark to IB grade (approximate for Ab Initio):
0-4: Band 1 | 5-9: Band 2 | 10-13: Band 3 | 14-18: Band 4 | 19-23: Band 5 | 24-27: Band 6 | 28-30: Band 7`
      : `IB Markscheme criteria (each scored /6):
- Criterion A: Language — grammar accuracy, tense usage, vocabulary range, syntax variety
- Criterion B: Message — clarity, organization, development of ideas, coherence
- Criterion C: Conceptual understanding — relevance to theme, appropriateness to text type, cultural awareness

IB Band descriptors:
- 1–2: Very limited, many errors, little coherence
- 3–4: Basic, some errors, limited development
- 5–6: Adequate, mostly accurate, adequate ideas
- 7–9: Good, accurate, well-organized, some sophistication
- 10–12: Very good, accurate, well-developed, varied vocabulary
- 13–15: Excellent, sophisticated, precise, rich vocabulary
- 16–18: Outstanding, near-native, highly sophisticated

Convert total mark to IB grade:
0–5: Band 1 | 6–8: Band 2 | 9–11: Band 3 | 12–14: Band 4 | 15–16: Band 5 | 17: Band 6 | 18: Band 7`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an experienced IB Spanish ${isAbInitio ? "Ab Initio" : "B"} examiner. Evaluate a student's written response using the official IB Spanish ${isAbInitio ? "Ab Initio" : "B"} markscheme.

The task required a ${typeName} related to the theme "${themeName}".

${criteriaText}

Return a JSON object:
{
  "criterionA": {
    "mark": <0-${isAbInitio ? 12 : 6}>,
    "feedback": "Detailed feedback in English on grammar, tense, vocabulary.",
    "corrections": [
      {"original": "exact phrase from student's text", "corrected": "corrected version", "explanation": "Brief explanation in English"}
    ]
  },
  "criterionB": {
    "mark": <0-${isAbInitio ? 12 : 6}>,
    "feedback": "Detailed feedback in English on message clarity and organization."
  },
  "criterionC": {
    "mark": <0-6>,
    "feedback": "Detailed feedback in English on theme relevance and text type appropriateness."
  },
  "totalMark": <sum of A+B+C>,
  "ibBand": <1-7>,
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "areasToImprove": ["Specific improvement area 1", "Specific improvement area 2"],
  "vocabularySuggestions": [
    {"original": "basic word used", "advanced": "more sophisticated alternative", "reason": "Why this is better for IB"}
  ],
  "connectorSuggestions": ["connector1", "connector2", "connector3"],
  "modelRewrites": [
    {"original": "Exact sentence from the student's essay", "improved": "Rewritten at Band 6-7 level in Spanish", "explanation": "What was improved"}
  ]
}

- corrections: provide 2–5 most important grammar/language corrections
- vocabularySuggestions: provide 3–5 vocabulary upgrades
- modelRewrites: rewrite exactly 2–3 of the student's sentences at a higher level
- Be specific and reference the actual student text
- Return ONLY valid JSON`,
        },
        {
          role: "user",
          content: `Task prompt:\n${prompt}\n\nStudent's essay:\n${essay}`,
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return res.json(JSON.parse(raw));
  } catch (err) {
    console.error("writing/feedback error:", err);
    return res.status(500).json({ error: "Error al evaluar el texto." });
  }
});

// ── Rewrite essay at Band 7 ──────────────────────────────────────────────────
router.post("/writing/rewrite", async (req, res) => {
  const { prompt, essay, textType, level = "b" } = req.body as {
    prompt: string;
    essay: string;
    textType?: string;
    level?: "b" | "ab_initio";
  };

  const typeName = TEXT_TYPE_NAMES[textType ?? ""] ?? "text";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert Spanish ${level === "ab_initio" ? "Ab Initio" : "B"} writer. Rewrite the student's essay at a high IB Band 7 level for this course.

Requirements:
- Keep the SAME structure and main ideas as the original
- Write the same ${typeName} format with appropriate conventions
- Use appropriate vocabulary (${level === "ab_initio" ? "A2-B1 level, high-frequency words" : "B2-C1 level"})
- Employ grammatical structures expected for a 7: ${level === "ab_initio" ? "consistent present, accurate preterite and imperfect, basic future, cohesive devices (y, pero, también, porque). AVOID subjunctive and passive voice unless in a common fixed phrase." : "subjunctive, conditional, passive voice, complex clauses"}
- Use varied sentence length and strong discourse connectors
- Maintain cultural authenticity
- Match the word count of the original (±10%)
- Write ONLY the rewritten essay in Spanish. No preamble, no explanation.`,
        },
        {
          role: "user",
          content: `Task:\n${prompt}\n\nOriginal essay:\n${essay}`,
        },
      ],
      temperature: 0.5,
      max_completion_tokens: 1500,
    });

    const rewritten = completion.choices[0]?.message?.content?.trim() ?? "";
    return res.json({ rewritten });
  } catch (err) {
    console.error("writing/rewrite error:", err);
    return res.status(500).json({ error: "Error al reescribir el texto." });
  }
});

export default router;
