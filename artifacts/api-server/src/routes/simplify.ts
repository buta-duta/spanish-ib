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

STRICT RULE SET FOR AB INITIO REWRITING (A1-A2 SURVIVAL LEVEL):

1. Grammar Ceiling (EXTREMELY STRICT):
   - Use ONLY the Present Indicative (e.g., "Yo como", "Ella vive").
   - AVOID all past tenses (no Preterite, no Imperfect).
   - AVOID all Subjunctive, Conditionals, and Future tenses.
   - Use "hay" instead of more complex existence verbs.

2. Sentence Structure:
   - Use only very short, simple sentences (Subject + Verb + Object).
   - Maximum 5–8 words per sentence.
   - NO complex connectors like "no obstante", "sin embargo", or "aunque". Use "y", "o", "pero".

3. Vocabulary Simplification (PRIORITY):
   - Use only the most common 500-1000 'survival' Spanish words.
   - AVOID all academic, formal, or specialized vocabulary.
   - MANDATORY VOCABULARY SWAPS (Use the simple version on the right):
     * gastronomía / platillos -> comida
     * vestimenta / atuendo -> ropa
     * residencia / domicilio / vivienda -> casa
     * residir / habitar -> vivir
     * establecimiento / local -> tienda
     * laborar / desempeñar -> trabajar
     * vehículo / transporte -> coche / tren / autobús
     * incrementar / aumentar -> subir / ser más
     * disminuir / reducir -> bajar / ser menos
     * solicitar / requerir -> pedir
     * obsequiar -> dar / regalar
     * retornar -> volver / ir a casa
     * iniciar / comenzar -> empezar
     * finalizar / concluir -> terminar
     * de color rojo/azul -> es rojo/azul

4. Clarity:
   - If a concept is too complex to say with basic words, simplify the concept itself or remove it.
   - Use the most common verbs (ser, estar, tener, hacer, ir, querer, poder, saber).

FORMAT:
Return a JSON object with exactly these fields:
{
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
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return res.json({
      simplifiedText: parsed.simplifiedText ?? "",
      simplifiedQuestion: parsed.simplifiedQuestion ?? "",
    });
  } catch (err) {
    console.error("simplify/ab-initio error:", err);
    return res.status(500).json({ error: "Error al simplificar el texto." });
  }
});

export default router;
