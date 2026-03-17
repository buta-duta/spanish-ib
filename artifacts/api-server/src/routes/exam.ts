import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  textToSpeech,
  speechToText,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import { Buffer } from "node:buffer";

const router: IRouter = Router();

const THEME_DESCRIPTIONS: Record<string, string> = {
  identidades: `
You are an experienced IB Spanish B oral examiner conducting a formal oral exam.
The current theme is "Identidades" (Identities).
Focus areas: personal beliefs, relationships, cultural identity, self-concept, family values, social roles, community belonging, traditions, generational differences, and personal development.
Subthemes include: national identity, multiculturalism, language and identity, personal values, gender roles, social media and self-image.
`,
  experiencias: `
You are an experienced IB Spanish B oral examiner conducting a formal oral exam.
The current theme is "Experiencias" (Experiences).
Focus areas: travel, memorable events, life milestones, holidays, cultural exchanges, volunteering, personal challenges, rites of passage, and transformative moments.
Subthemes include: gap years, exchange programs, adventure travel, family traditions, personal growth through adversity, unforgettable experiences.
`,
  "ingenio-humano": `
You are an experienced IB Spanish B oral examiner conducting a formal oral exam.
The current theme is "Ingenio humano" (Human ingenuity).
Focus areas: technology, innovation, media, arts, scientific progress, inventions, creativity, literature, music, architecture, and design.
Subthemes include: artificial intelligence, social media, digital art, scientific discoveries, space exploration, environmental technology.
`,
  "organizacion-social": `
You are an experienced IB Spanish B oral examiner conducting a formal oral exam.
The current theme is "Organización social" (Social organization).
Focus areas: education, law, justice, political systems, economics, healthcare, social inequality, community structures, democracy, and civic responsibility.
Subthemes include: school systems, immigration, human rights, poverty, healthcare access, political participation, social movements.
`,
  "compartir-el-planeta": `
You are an experienced IB Spanish B oral examiner conducting a formal oral exam.
The current theme is "Compartir el planeta" (Sharing the planet).
Focus areas: environment, sustainability, climate change, global issues, biodiversity, natural resources, international cooperation, and ecological responsibility.
Subthemes include: renewable energy, deforestation, ocean pollution, carbon footprint, endangered species, global warming, green technology.
`,
};

const BASE_INSTRUCTIONS = `
IMPORTANT INSTRUCTIONS:
1. Always respond ENTIRELY in Spanish (Español). Never switch to English.
2. Ask ONE focused question at a time. Never ask multiple questions in a single turn.
3. After the student responds, provide brief encouraging feedback (1-2 sentences), then ask a follow-up question.
4. Vary your question types: descriptive, opinion-based, hypothetical, comparative.
5. After 6-8 exchanges, you may occasionally link to a second IB theme to train cross-theme thinking (Band 6-7 skill).
6. Keep your responses concise: feedback (1-2 sentences) + question (1 sentence).
7. Start with an accessible warm-up question, then gradually increase difficulty.
8. Use informal "tú" consistently for student interactions.
9. Show authentic examiner personality: be professional but encouraging.
10. Reference the theme in your questions naturally.

Begin the exam by welcoming the student warmly in Spanish and asking your first question about the theme.
`;

router.post("/exam/chat", async (req, res) => {
  const { messages, theme, sessionTurn, regenerate, skip } = req.body;

  if (!theme || !messages) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const themeKey = theme.toLowerCase().replace(/\s+/g, "-");
  const themePrompt = THEME_DESCRIPTIONS[themeKey] || THEME_DESCRIPTIONS["identidades"];

  const regenerateInstruction = regenerate
    ? `\n\nSPECIAL INSTRUCTION — REGENERATE QUESTION: The student has requested a different question.
- Look carefully at the student's LAST response in the conversation.
- Ask a DIFFERENT question that builds naturally on what they just said — go deeper into a specific detail, perspective, or aspect they mentioned.
- Do NOT repeat the previous question or change the topic abruptly.
- The new question should feel like a natural follow-up that any good examiner would ask after hearing that response.
- Keep it as ONE focused question only.`
    : "";

  const skipInstruction = skip
    ? `\n\nSPECIAL INSTRUCTION — SKIP QUESTION: The student has chosen to skip the current question.
- Acknowledge graciously in 1 short sentence (e.g. "Entendido, pasamos a otro tema.").
- Then immediately ask a COMPLETELY FRESH question on a different sub-topic within the same theme.
- Do not dwell on the skipped question.`
    : "";

  const systemPrompt = themePrompt + BASE_INSTRUCTIONS + regenerateInstruction + skipInstruction;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...messages.filter((m: { role: string }) => m.role !== "system"),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Exam chat error:", error);
    res.write(`data: ${JSON.stringify({ error: "Error connecting to AI" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

router.post("/exam/transcribe", async (req, res) => {
  const { audioBase64 } = req.body;

  if (!audioBase64) {
    res.status(400).json({ error: "Missing audioBase64" });
    return;
  }

  try {
    const rawBuffer = Buffer.from(audioBase64, "base64");
    const { buffer, format } = await ensureCompatibleFormat(rawBuffer);
    const text = await speechToText(buffer, format);
    res.json({ text });
  } catch (error) {
    console.error("Transcription error:", error);
    res.status(500).json({ error: "Transcription failed" });
  }
});

router.post("/exam/tts", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  try {
    const audioBuffer = await textToSpeech(text, "nova", "mp3");
    const audioBase64 = audioBuffer.toString("base64");
    res.json({ audioBase64 });
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({ error: "TTS failed" });
  }
});

router.post("/exam/feedback", async (req, res) => {
  const { messages, theme } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Missing messages" });
    return;
  }

  const userMessages = messages.filter((m: { role: string; content: string }) => m.role === "user");

  if (userMessages.length === 0) {
    res.status(400).json({ error: "No user messages to analyse" });
    return;
  }

  const conversationText = messages
    .filter((m: { role: string }) => m.role !== "system")
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "Student" : "Examiner"}: ${m.content}`)
    .join("\n");

  const feedbackPrompt = `You are an experienced IB Spanish B examiner providing detailed feedback on a student's oral exam performance.

EXAM TRANSCRIPT:
${conversationText}

IB THEME: ${theme || "General"}

Analyse this oral exam conversation and provide structured feedback in ENGLISH. Return ONLY valid JSON with this exact structure:

{
  "overallComment": "2-3 sentence overall assessment",
  "languageAnalysis": {
    "grammarMistakes": [
      { "error": "exact error from transcript", "correction": "corrected version", "explanation": "why it's wrong" }
    ],
    "tenseUsage": "Assessment of tense usage (present, past, future, subjunctive etc.)",
    "vocabularyRange": "Assessment of vocabulary range: basic/intermediate/advanced, with specific observations"
  },
  "improvementSuggestions": {
    "betterStructures": ["suggestion 1", "suggestion 2", "suggestion 3"],
    "connectors": ["connector examples to use", "sin embargo", "no obstante", "por lo tanto"],
    "vocabulary": ["advanced word suggestions with English meaning"]
  },
  "ibCriteria": {
    "criterionA": { "band": 6, "label": "Language", "comments": "Specific assessment of grammar, vocabulary, register" },
    "criterionB": { "band": 5, "label": "Message", "comments": "Specific assessment of ideas, arguments, detail" },
    "criterionC": { "band": 5, "label": "Conceptual Understanding", "comments": "Assessment of theme engagement and analysis" },
    "criterionD": { "band": 6, "label": "Interaction", "comments": "Assessment of responsiveness and conversation flow" }
  },
  "improvedExamples": [
    { "original": "student's actual sentence", "improved": "better version in Spanish", "note": "explanation of improvement" }
  ]
}

Use the student's ACTUAL words from the transcript in grammarMistakes and improvedExamples. IB bands range from 1-7. Be specific and constructive.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: feedbackPrompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "Empty feedback response" });
      return;
    }

    const feedback = JSON.parse(content);
    res.json({ feedback });
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: "Feedback generation failed" });
  }
});

export default router;
