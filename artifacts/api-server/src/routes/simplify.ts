import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ── Simplify Spanish to Ab Initio (A1-A2) ────────────────────────────────────
router.post("/simplify/ab-initio", async (req, res) => {
  const { text, question } = req.body as { text: string; question: string };

  if (!text) {
    return res.status(400).json({ error: "No se proporcionó texto para simplificar." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert IB Spanish Ab Initio teacher. Your mission is to rewrite complex, intermediate-level (Spanish B / B1-B2) Spanish content into the simplest possible beginner level (Ab Initio / A1-A2).

STRICT RULE SET FOR A1 LEXICAL PROFILE REWRITING:

1. Lexical Ceiling (A1):
   - Use ONLY the top 1,000 most common Spanish words.
   - REPLACE all B-level words: introspección -> pensar, gastronomía -> comida, infraestructura -> edificios, laborar -> trabajar, transporte -> coche/tren, obsequiar -> dar.

2. Sentence Limit:
   - PROHIBITED: Sentences longer than 12 words. If a sentence is long, split it into two short ones.

3. Grammar Ceiling:
   - Present Indicative ONLY (Yo como, Ella vive).
   - No past, future, or subjunctive.

4. Structure:
   - Simple Subject + Verb + Object (SVO) sentences only.

FORMAT:
Return a JSON object with exactly these fields:
{
  "simplifiedTitle": "A very short simple title (3-5 words)",
  "simplifiedText": "The rewritten simple text",
  "simplifiedQuestion": "The rewritten simple question"
}

Return ONLY valid JSON with no extra text.`,
        },
        {
          role: "user",
          content: `Original Text: "${text}"\nOriginal Question: "${question || ""}"`,
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return res.json({
      simplifiedTitle: parsed.simplifiedTitle ?? "",
      simplifiedText: parsed.simplifiedText ?? "",
      simplifiedQuestion: parsed.simplifiedQuestion ?? "",
    });
  } catch (err) {
    console.error("simplify/ab-initio error:", err);
    return res.status(500).json({ error: "Error al simplificar el texto." });
  }
});

export default router;
