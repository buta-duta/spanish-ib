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
1. QUESTIONS: Always ask questions in Spanish. Never switch to English when asking.
2. Ask ONE focused question at a time. Never ask multiple questions in a single turn.
3. RESPONSE FORMAT after the student answers (follow this exact order every time):
   a) Brief encouraging comment in Spanish (1 sentence, e.g. "¡Muy bien!", "¡Interesante punto!")
   b) ONE English language tip marked with "💡" — pick ONE of:
      - Grammar correction: "💡 Grammar: Instead of '[their error]', say '[correct form]' ([brief reason])"
      - Vocabulary upgrade: "💡 Vocab: '[their word]' works — try '[advanced word]' for a stronger B2 impression"
      - Structure tip: "💡 Tip: Using connectors like 'sin embargo', 'cabe destacar que', or 'no obstante' would elevate this response"
      - Only include this tip if the student actually made a mistake or used basic vocabulary. If they performed well, skip the tip and move straight to the question.
   c) The next question in Spanish (1 sentence)
4. Vary your question types: descriptive, opinion-based, hypothetical, comparative.
5. After 6-8 exchanges, occasionally link to a second IB theme (Band 6-7 skill).
6. Start with an accessible warm-up question, then gradually increase difficulty.
7. Use informal "tú" consistently for student interactions.
8. Show authentic examiner personality: be professional but encouraging.
9. Reference the theme in your questions naturally.

Begin the exam by welcoming the student warmly in Spanish and asking your first question about the theme. (No English tip on the opening turn — that's for after the student responds.)
`;

router.post("/exam/chat", async (req, res) => {
  const { messages, theme, sessionTurn, regenerate, skip, level = "b" } = req.body;

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

  const isAbInitio = level === "ab_initio";
  const baseInstructions = `
IMPORTANT INSTRUCTIONS:
1. QUESTIONS: Always ask questions in Spanish. Never switch to English when asking.
2. Ask ONE focused question at a time. Never ask multiple questions in a single turn.
3. RESPONSE FORMAT after the student answers (follow this exact order every time):
   a) Brief encouraging comment in Spanish (1 sentence, e.g. "¡Muy bien!", "¡Interesante punto!")
   b) ONE English language tip marked with "💡" — pick ONE of:
      - Grammar correction: "💡 Grammar: Instead of '[their error]', say '[correct form]' ([brief reason])"
      - Vocabulary upgrade: "💡 Vocab: '[their word]' works — try '[advanced word]' for a stronger ${isAbInitio ? 'A2/B1' : 'B2'} impression"
      - Structure tip: "💡 Tip: Using ${isAbInitio ? 'basic connectors like "porque", "pero", or "también"' : 'connectors like "sin embargo" or "no obstante"'} would elevate this response"
      - Only include this tip if the student actually made a mistake or used basic vocabulary. If they performed well, skip the tip and move straight to the question.
   c) The next question in Spanish (1 sentence)
4. Vary your question types: descriptive, opinion-based, hypothetical, comparative.
${isAbInitio ? '5. Keep questions simple and direct, suited for Ab Initio (A1-A2).' : '5. After 6-8 exchanges, occasionally link to a second IB theme (Band 6-7 skill).'}
6. Start with an accessible warm-up question, then gradually increase difficulty.
7. Use informal "tú" consistently for student interactions.
8. Show authentic examiner personality: be professional but encouraging.
9. Reference the theme in your questions naturally.
10. ${isAbInitio ? 'CRITICAL: Conduct the entire exam using simple A1-A2 vocabulary. Avoid complex sentence structures when asking questions.' : 'Use standard academic Spanish.'}

Begin the exam by welcoming the student warmly in Spanish and asking your first question about the theme. (No English tip on the opening turn — that's for after the student responds.)
`;

  const systemPrompt = themePrompt.replace(/IB Spanish B/g, isAbInitio ? "IB Spanish Ab Initio" : "IB Spanish B") + baseInstructions + regenerateInstruction + skipInstruction;

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
      model: "gpt-4o-mini",
      max_completion_tokens: 1500,
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

// ── Image-based oral exam ─────────────────────────────────────────────────────
router.post("/exam/image-chat", async (req, res) => {
  const { messages, theme, imageDescription, imageCaption, sessionTurn, rephrase, skip, level = "b" } = req.body;
  if (!messages || !imageDescription) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const themeKey = (theme || "").toLowerCase().replace(/\s+/g, "-");
  const themeName: Record<string, string> = {
    identidades: "Identidades",
    experiencias: "Experiencias",
    "ingenio-humano": "Ingenio humano",
    "organizacion-social": "Organización social",
    "compartir-el-planeta": "Compartir el planeta",
  };

  const rephraseInstruction = rephrase
    ? `\n\nSPECIAL INSTRUCTION — REFORMULAR: The student has asked for the question to be rephrased. Ask the EXACT SAME concept or idea using completely different vocabulary, sentence structure and wording. Do NOT ask a new question — just restate the same one differently. Keep it natural and conversational.`
    : "";

  const skipInstruction = skip
    ? `\n\nSPECIAL INSTRUCTION — SKIP: The student wants to move on from the current question. Acknowledge briefly and naturally ("Entendido, pasemos a..."), then ask a DIFFERENT question about another aspect of the image or theme. Move forward in the descriptive → interpretive → analytical progression.`
    : "";

  const isAbInitio = level === "ab_initio";
  const systemPrompt = `You are an experienced IB Spanish ${isAbInitio ? "Ab Initio" : "B"} oral examiner conducting a formal Individual Oral (IO) exam based on an image stimulus.

The student is looking at a photograph described as:
"${imageCaption || "An image related to the theme"}"

DETAILED IMAGE DESCRIPTION (for your reference — the student can see the image):
${imageDescription}

The IB theme being examined is: ${themeName[themeKey] || "Compartir el planeta"}

YOUR ROLE AS EXAMINER:
1. ALWAYS respond ENTIRELY in Spanish. Never use English.
2. On the FIRST turn (when messages list is empty): Welcome the student warmly, briefly describe the task, and ask them to begin describing what they see in the image.
3. On SUBSEQUENT turns: React to the student's response with brief encouraging feedback (1 sentence), then ask ONE focused follow-up question.
4. Follow this PROGRESSION through the exam:
${isAbInitio 
  ? `   - Phase 1: Descriptive — "¿Qué hay en la foto? ¿Qué llevan puesto?"
   - Phase 2: Interpretive — "¿Por qué están allí? ¿Qué hora del día es?"
   - Phase 3: Personal connection — "¿Te gusta hacer esto? ¿Por qué?"`
  : `   - Phase 1 (first 2–3 turns): Descriptive — "¿Qué ves en la imagen? ¿Qué está pasando?"
   - Phase 2 (middle turns): Interpretive — "¿Por qué crees que...? ¿Qué mensaje transmite esta imagen?"
   - Phase 3 (later turns): Analytical + Cultural — "¿Cómo se relaciona esto con la situación en...? ¿Qué soluciones propones?"`
}
5. Questions must be open-ended, IB-standard, and directly related to the image AND theme.
6. ${isAbInitio ? 'Keep questions simple, avoid overly abstract topics.' : 'Cross-theme connections earn Band 6-7 marks.'}
7. Keep responses concise: feedback (1 sentence) + one question (1 sentence).
8. Use informal "tú" throughout.
9. Show the personality of a professional but encouraging examiner.
10. If the student is on turn ${sessionTurn || 0} of the exam, calibrate difficulty accordingly.
11. ${isAbInitio ? `
!!! CRITICAL: AB INITIO (A1-A2) GRAMMATICAL FIREWALL !!!
- GRAMMAR: Use ONLY Present Indicative. Absolutely NO past tenses (fui, hice, era) and NO Subjunctive (sea, quiera, vaya).
- SYNTAX: Sentences MUST be shorter than 10 words. 
- FORBIDDEN: Do NOT use compound sentences. Do NOT use 'que', 'aunque', or 'mientras'. Split every thought into a simple sentence. 
- EXAMPLE: Convert "El Camino ha sido largo" to "El Camino es largo".
` : 'Use standard academic Spanish.'}

12. MANDATORY STRUCTURED RESPONSE (Use these exact headers for every turn):
    [Corrección]: Provide a list of grammar or spelling fixes for the student's message. (If perfect, say "¡Texto perfecto!").
    
    [Respuesta]: A brief, natural conversational response in Spanish at the ${isAbInitio ? 'Ab Initio' : 'B'} level.
    
    [Pregunta]: Exactly ONE follow-up question related ONLY to the IB Theme: ${themeName[themeKey] || "Compartir el planeta"}.

ENCOURAGE PALMS-STYLE RESPONSES:
Structure your questions to elicit these elements (don't mention PALMS explicitly):
- Point: Ask students to state a clear position or observation
- Answer/Evidence: Ask for specific examples or details they can see or know
- Link: Guide them to connect to the theme or a real-world context
- Meaning: Ask them to explain the significance or implications
- Structure: Reward use of discourse markers — react positively when students use ${isAbInitio ? '"porque", "y", "también"' : '"sin embargo", "además", "por lo tanto", "en cambio"'}${rephraseInstruction}${skipInstruction}`;

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
      model: "gpt-4o-mini",
      max_completion_tokens: 1500,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Image chat error:", error);
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

// Natural Spanish examiner TTS — uses gpt-audio with a Spanish-specific system prompt
// for authentic intonation, pacing, and rhythm (F22)
async function textToSpeechExaminer(text: string): Promise<Buffer> {
  const response = await (openai as any).chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice: "shimmer", format: "mp3" },
    messages: [
      {
        role: "system",
        content:
          "Eres una examinadora del IB de habla hispana. Habla con entonación natural, cálida y profesional en español. Usa un ritmo conversacional auténtico con variación de tono. Evita sonar monótona o robótica.",
      },
      {
        role: "user",
        content: `Di exactamente esto en voz alta, sin añadir nada extra: ${text}`,
      },
    ],
  });
  const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
  return Buffer.from(audioData, "base64");
}

router.post("/exam/tts", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  try {
    const audioBuffer = await textToSpeechExaminer(text);
    const audioBase64 = audioBuffer.toString("base64");
    res.json({ audioBase64 });
  } catch (error) {
    console.error("TTS error:", error);
    // Fallback to standard TTS if custom fails
    try {
      const fallback = await textToSpeech(text, "shimmer", "mp3");
      res.json({ audioBase64: fallback.toString("base64") });
    } catch {
      res.status(500).json({ error: "TTS failed" });
    }
  }
});

router.post("/exam/feedback", async (req, res) => {
  const { messages, theme, level = "b" } = req.body;

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

  const isAbInitio = level === "ab_initio";
  const feedbackPrompt = `You are an experienced IB Spanish ${isAbInitio ? "Ab Initio" : "B"} examiner providing detailed feedback on a student's oral exam performance.

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
    "connectors": ["connector examples to use"],
    "vocabulary": ["advanced word suggestions with English meaning"]
  },
  "ibCriteria": {
    "criterionA": { "band": 6, "label": "Language", "comments": "Specific assessment of grammar, vocabulary, register" },
    "criterionB": { "band": 5, "label": "Message", "comments": "Specific assessment of ideas, arguments, detail" },
    ${isAbInitio ? `"criterionC": { "band": 3, "label": "Interactive Skills", "comments": "Assessment of responsiveness and communication" }` : `"criterionC": { "band": 5, "label": "Conceptual Understanding", "comments": "Assessment of theme engagement and analysis" },
    "criterionD": { "band": 6, "label": "Interaction", "comments": "Assessment of responsiveness and conversation flow" }`}
  },
  "improvedExamples": [
    { "original": "student's actual sentence", "improved": "better version in Spanish", "note": "explanation of improvement" }
  ]
}

Use the student's ACTUAL words from the transcript in grammarMistakes and improvedExamples. IB bands use the official max marks: ${isAbInitio ? "A: 1-12, B: 1-12, C: 1-6" : "A, B, C, D are 1-10 or 1-7 depending on criteria"}. Be specific and constructive.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 2048,
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

// ── IB image oral feedback ────────────────────────────────────────────────────
router.post("/exam/image-feedback", async (req, res) => {
  const { messages, imageCaption, theme, level = "b" } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Missing messages" });
    return;
  }

  const conversationText = messages
    .filter((m: { role: string }) => m.role !== "system")
    .map((m: { role: string; content: string }) =>
      `${m.role === "user" ? "Student" : "Examiner"}: ${m.content}`
    )
    .join("\n");

  const isAbInitio = level === "ab_initio";
  const feedbackPrompt = `You are an experienced IB Spanish ${isAbInitio ? "Ab Initio" : "B"} examiner grading a student's Individual Oral (IO) based on an image stimulus.

Image: "${imageCaption || "Image-based oral"}"
Theme: ${theme || "General"}

EXAM CONVERSATION:
${conversationText}

Grade the student using the official IB Spanish ${isAbInitio ? "Ab Initio" : "B"} Individual Oral criteria. Return ONLY valid JSON:

{
  "criterionA": {
    "score": <${isAbInitio ? "1-12" : "1-10"}>,
    "label": "Lengua",
    "feedback": "2-3 sentence specific assessment of grammar accuracy, vocabulary range, register, tense variety, and sentence complexity. Reference ACTUAL quotes from the student."
  },
  "criterionB": {
    "score": <${isAbInitio ? "1-12" : "1-10"}>,
    "label": "Mensaje",
    "feedback": "2-3 sentence specific assessment of ideas, arguments, relevance to image, detail, examples used, and development of points."
  },
  "criterionC": {
    "score": <${isAbInitio ? "1-6" : "1-10"}>,
    "label": "${isAbInitio ? "Habilidades interactivas" : "Comprensión conceptual"}",
    "feedback": "2-3 sentence specific assessment of engagement with the IB theme, cultural references, cross-theme connections, and depth of analysis."
  }${isAbInitio ? `` : `,
  "criterionD": {
    "score": <1-10>,
    "label": "Interacción",
    "feedback": "2-3 sentence specific assessment of responsiveness to examiner questions, spontaneity, conversation flow, and ability to maintain and develop discussion."
  }`}
}

Be fair, constructive, and specific. Grade ONLY what was actually said. Bands range from 1–10 per criterion (or 1-12/1-6 for Ab Initio).`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1500,
      messages: [{ role: "user", content: feedbackPrompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty feedback" }); return; }
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Image feedback error:", error);
    res.status(500).json({ error: "Feedback generation failed" });
  }
});

// ── Word explanation ──────────────────────────────────────────────────────────
router.post("/exam/word", async (req, res) => {
  const { word, context } = req.body;
  if (!word) { res.status(400).json({ error: "Missing word" }); return; }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: "You are a Spanish language dictionary. Return only valid JSON with no markdown code blocks." },
        {
          role: "user",
          content: `Spanish word: "${word}"\nContext sentence: "${(context || word).slice(0, 300)}"\n\nReturn JSON only:\n{ "phonetic": "readable syllable pronunciation like deh-sah-rroh-yoh", "meaning": "concise English meaning based on context (max 15 words)", "partOfSpeech": "noun / verb / adjective / adverb / etc" }`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const data = JSON.parse(response.choices[0]?.message?.content || "{}");
    res.json(data);
  } catch {
    res.status(500).json({ error: "Word explanation failed" });
  }
});

export default router;
