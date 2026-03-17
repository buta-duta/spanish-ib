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
  const { theme = "experiencias", textType = "article", previousPrompts = [] } = req.body as {
    theme?: string;
    textType?: string;
    previousPrompts?: string[];
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
          content: `You are an IB Spanish B examiner. Generate a single, realistic IB-style writing task prompt in English.

The prompt must:
- Require writing a ${typeName} in Spanish
- Be clearly related to the IB theme: ${themeName}
- Be realistic and specific (include a scenario, audience, and clear goal)
- Be appropriate for B1-B2 Spanish level students
- State the recommended word count (between 250–400 words)
- Use the exact IB format: include a situation, purpose, and recipient/audience where relevant${avoidSection}

Return ONLY the prompt text. No explanation, no JSON. Just the prompt as it would appear on an IB exam paper.`,
        },
      ],
      temperature: 0.9,
    });

    const prompt = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ prompt });
  } catch (err) {
    console.error("writing/prompt error:", err);
    res.status(500).json({ error: "Error al generar la pregunta." });
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an experienced IB Spanish B examiner. Evaluate a student's written response using the official IB Spanish B markscheme.

The task required a ${typeName} related to the theme "${themeName}".

IB Markscheme criteria (each scored /6):
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
0–5: Band 1 | 6–8: Band 2 | 9–11: Band 3 | 12–14: Band 4 | 15–16: Band 5 | 17: Band 6 | 18: Band 7

Return a JSON object:
{
  "criterionA": {
    "mark": <0-6>,
    "feedback": "Detailed feedback in English on grammar, tense, vocabulary.",
    "corrections": [
      {"original": "exact phrase from student's text", "corrected": "corrected version", "explanation": "Brief explanation in English"}
    ]
  },
  "criterionB": {
    "mark": <0-6>,
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
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error("writing/feedback error:", err);
    res.status(500).json({ error: "Error al evaluar el texto." });
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
          content: `You are an expert Spanish B writer. Rewrite the student's essay at IB Band 7 level.

Requirements:
- Keep the SAME structure and main ideas as the original
- Write the same ${typeName} format with appropriate conventions
- Use sophisticated, varied vocabulary (B2-C1)
- Employ complex grammatical structures: subjunctive, conditional, passive voice
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
    });

    const rewritten = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ rewritten });
  } catch (err) {
    console.error("writing/rewrite error:", err);
    res.status(500).json({ error: "Error al reescribir el texto." });
  }
});

export default router;
