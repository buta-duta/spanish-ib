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

STRICT 'ZERO TOLERANCE' LOGIC-GATE REWRITING:

1. THE GRAMMAR BAN: 
   - You are STRICTLY FORBIDDEN from using any verb that is not in the Present Indicative.
   - NO Preterite, NO Imperfect, NO Subjunctive, NO Compound tenses.
   - Bad: 'Yo nací en Madrid.' -> Fix: 'Yo soy de Madrid.'
   - Bad: 'Me dejó pensando.' -> Fix: 'Pienso mucho.'
   - Bad: 'Cuando fui a Medellín...' -> Fix: 'Yo voy a Medellín.'

2. THE SYNTAX BAN: 
   - No sentence can have more than one verb. 
   - If a sentence has two verbs (e.g., 'Dicen que soy...'), you MUST split it into two sentences ('Ellos hablan. Yo soy...').

3. THE LEXICAL CEILING:
   - Use ONLY high-frequency A1 vocabulary.
   - No metaphors. No abstract concepts.

FORMAT:
Return a JSON object with exactly these fields:
{
  "simplifiedTitle": "Short title (3-word max)",
  "simplifiedText": "The rewritten logic-gate text",
  "simplifiedQuestion": "The rewritten logic-gate question"
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
