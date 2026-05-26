import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { sendOpenAIError } from "./openaiError";

const router: IRouter = Router();

router.post("/progress/session-summary", async (req, res) => {
  const { module, mistakes, score } = req.body as {
    module?: string;
    mistakes?: Array<{ category: string; description: string; example?: string; correction?: string }>;
    score?: { correct: number; total: number };
  };

  if (!module || !Array.isArray(mistakes)) {
    res.status(400).json({ error: "Missing module or mistakes." });
    return;
  }

  if (mistakes.length === 0) {
    const summary = score
      ? `Strong session (${score.correct}/${score.total} correct). Keep building range and accuracy.`
      : "Strong session. Keep practising for fluency and consistency.";
    res.json({ summary, focusAreas: [] });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 400,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You summarise IB Spanish B practice sessions. Reply JSON only: { \"summary\": string (2-3 sentences, English), \"focusAreas\": string[] (3-5 short snake_case tags e.g. grammar_preterite, vocabulary_environment) }",
        },
        {
          role: "user",
          content: JSON.stringify({ module, score, mistakes: mistakes.slice(0, 12) }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { summary?: string; focusAreas?: string[] };
    res.json({
      summary: parsed.summary || "Review the mistakes below and practise those areas next.",
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 6) : [],
    });
  } catch (error) {
    console.error("session-summary error:", error);
    return sendOpenAIError(res, error, "Could not generate session summary");
  }
});

export default router;
