import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { sendOpenAIError } from "./openaiError";

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
  const { theme = "experiencias", textType = "article", previousPrompts = [] } = req.body as {
    theme?: string;
    textType?: string;
    previousPrompts?: string[];
  };

  const themeName = THEME_NAMES[theme] ?? theme;
  const typeName = TEXT_TYPE_NAMES[textType] ?? textType;
  const avoidSection =
    previousPrompts.length > 0
      ? `\n\nNO repitas estas preguntas anteriores:\n${previousPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un examinador experto del IB Spanish B (Prueba 1, Expresión escrita, Nivel Medio).

OBJETIVO:
Generar UNA tarea de escritura realista al estilo del examen oficial.

FORMATO EXACTO (como en las tareas oficiales):
1) Un breve párrafo introductorio que contextualice la situación (1-2 frases), igual que en los ejemplos del examen (p. ej. "Miles de turistas visitan los monumentos históricos de tu ciudad cada año, y como consecuencia...").
2) La instrucción de la tarea con DOS aspectos claros que el alumno debe abordar (p. ej. "describe..." y "explica...").
3) Indica el destinatario y el propósito.
4) Ofrece TRES opciones de tipo de texto entre las que elegir, presentadas en líneas separadas.

REQUISITOS:
- Nivel: B1-B2.
- Tema: ${themeName}.
- Tipo de texto sugerido como una de las opciones: ${typeName}.
- Vocabulario temático específico relacionado con ${themeName}.${avoidSection}

Devuelve ÚNICAMENTE el texto de la pregunta en español (párrafo introductorio + instrucción + destinatario + las tres opciones de tipo de texto).`,
        },
      ],
      temperature: 0.8,
      max_completion_tokens: 500,
    });

    const prompt = completion.choices[0]?.message?.content?.trim() ?? "";
    return res.json({ prompt });
  } catch (err) {
    console.error("writing/prompt error:", err);
    return sendOpenAIError(res, err, "Error al generar la pregunta.");
  }
});

// ── Evaluate writing + IB markscheme feedback ─────────────────────────────────
router.post("/writing/feedback", async (req, res) => {
  const { prompt, essay, theme, textType } = req.body as {
    prompt: string;
    essay: string;
    theme?: string;
    textType?: string;
  };

  if (!essay || essay.trim().length < 30) {
    return res.status(400).json({ error: "Texto demasiado corto." });
  }

  const themeName = THEME_NAMES[theme ?? ""] ?? theme ?? "general";
  const typeName = TEXT_TYPE_NAMES[textType ?? ""] ?? textType ?? "text";

  try {
    const criteriaText = `OFFICIAL IB Spanish B SL Paper 1 markscheme (total 30):
- Criterio A: Lengua — /12 (vocabulario adecuado y variado; estructuras gramaticales básicas y complejas; corrección lingüística que contribuye a la comunicación).
  Bandas: 0 (nada) | 1-3 limitado | 4-6 parcialmente eficaz | 7-9 eficaz y mayormente correcto | 10-12 muy eficaz, vocabulario variado con expresiones idiomáticas.
- Criterio B: Mensaje — /12 (pertinencia, desarrollo y organización de las ideas).
  Bandas: 0 | 1-3 cumplida parcialmente | 4-6 cumplida en general | 7-9 cumplida | 10-12 cumplida de forma eficaz.
  REGLA: si NO se aborda alguno de los aspectos requeridos en la tarea, el máximo en B es 6.
- Criterio C: Comprensión conceptual — /6 (tipo de texto, registro/tono y convenciones del tipo de texto).
  Bandas: 0 | 1-2 limitada | 3-4 mayormente demostrada | 5-6 plenamente demostrada.
  REGLA: si el tipo de texto no corresponde a la tarea, el máximo en C es 2.

Total = A + B + C (sobre 30). Recuerda: es nivel intermedio, no exijas perfección.
Conversión orientativa a banda IB (1-7) según el total /30: 0-6 → 1 | 7-11 → 2 | 12-16 → 3 | 17-20 → 4 | 21-24 → 5 | 25-27 → 6 | 28-30 → 7.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an experienced IB Spanish B examiner (SL Paper 1). Evaluate the student's written response using the official markscheme below.

The task required a ${typeName} related to the theme "${themeName}".

${criteriaText}

Return ONLY a valid JSON object:
{
  "criterionA": {
    "mark": <0-12>,
    "band": "1-3" | "4-6" | "7-9" | "10-12" | "0",
    "feedback": "Detailed feedback in English on vocabulary range, grammatical structures and accuracy.",
    "corrections": [
      {"original": "exact phrase from student's text", "corrected": "corrected version", "explanation": "Brief explanation in English"}
    ]
  },
  "criterionB": {
    "mark": <0-12>,
    "band": "1-3" | "4-6" | "7-9" | "10-12" | "0",
    "feedback": "Detailed feedback in English on relevance, development and organization of ideas."
  },
  "criterionC": {
    "mark": <0-6>,
    "band": "1-2" | "3-4" | "5-6" | "0",
    "feedback": "Detailed feedback in English on text type choice, register/tone and conventions."
  },
  "totalMark": <sum A+B+C, 0-30>,
  "ibBand": <1-7>,
  "criteriaTable": [
    {"criterion": "A: Lengua", "max": 12, "mark": <0-12>, "band": "<range>", "descriptor": "Spanish descriptor of the achieved band"},
    {"criterion": "B: Mensaje", "max": 12, "mark": <0-12>, "band": "<range>", "descriptor": "Spanish descriptor of the achieved band"},
    {"criterion": "C: Comprensión conceptual", "max": 6, "mark": <0-6>, "band": "<range>", "descriptor": "Spanish descriptor of the achieved band"}
  ],
  "augmentedResponse": [
    {"text": "fragment exactly as the student wrote it", "kind": "original"},
    {"text": "text the student is MISSING to reach full marks (additions/expansions, in Spanish, inserted at the right place)", "kind": "added"}
  ],
  "tenseOpportunities": [
    {"excerpt": "short quote from the student's text", "tense": "e.g. subjuntivo / condicional / pretérito imperfecto / futuro", "suggestion": "In Spanish: where and how they could have used this tense for a higher Criterion A mark"}
  ],
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "areasToImprove": ["Specific improvement area 1", "Specific improvement area 2"],
  "vocabularySuggestions": [
    {"original": "basic word used", "advanced": "more sophisticated alternative", "reason": "Why this is better for IB"}
  ],
  "connectorSuggestions": ["connector1", "connector2", "connector3"],
  "modelRewrites": [
    {"original": "Exact sentence from the student's essay", "improved": "Rewritten at top-band level in Spanish", "explanation": "What was improved"}
  ]
}

REQUIREMENTS:
- augmentedResponse: reconstruct the student's ENTIRE text in order as a sequence of segments. Keep the student's own words verbatim as "original" segments, and insert the content they are MISSING to reach full marks as "added" segments in the correct positions (these are the parts that, if added, would raise the mark). The concatenation of all "text" fields must read as an improved version of the essay.
- tenseOpportunities: 2-4 concrete moments where the student could have used a richer verb tense expected of a Spanish B student.
- corrections: 3-5 major grammar corrections.
- vocabularySuggestions: 3-5 sophisticated B2 synonyms.
- modelRewrites: rewrite 2 sentences at the top band.
- Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Task prompt:\n${prompt}\n\nStudent's essay:\n${essay}`,
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return res.json(JSON.parse(raw));
  } catch (err) {
    console.error("writing/feedback error:", err);
    return sendOpenAIError(res, err, "Error al evaluar el texto.");
  }
});

// ── Rewrite essay at Band 7 ──────────────────────────────────────────────────
router.post("/writing/rewrite", async (req, res) => {
  const { prompt, essay, textType } = req.body as {
    prompt: string;
    essay: string;
    textType?: string;
  };

  const typeName = TEXT_TYPE_NAMES[textType ?? ""] ?? "text";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert Spanish B writer. Rewrite the student's essay at a high IB Band 7 level for this course.

Requirements:
- Keep the SAME structure and main ideas as the original
- Write the same ${typeName} format with appropriate conventions
- Use appropriate vocabulary (B2-C1 level)
- Employ grammatical structures expected for a 7: subjunctive, conditional, passive voice, complex clauses
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
    return sendOpenAIError(res, err, "Error al reescribir el texto.");
  }
});

export default router;
