import { Router, type IRouter } from "express";
import {
  completeChat,
  streamChat,
  type ChatMessage,
} from "@workspace/integrations-gemini-ai-server";
import {
  textToSpeech,
  textToSpeechExaminer,
  speechToText,
  ensureCompatibleFormat,
  detectAudioFormat,
} from "@workspace/integrations-gemini-ai-server/audio";
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

const AB_INITIO_THEME_DESCRIPTIONS: Record<string, string> = {
  identidades: `
You are an experienced IB Spanish ab initio SL oral examiner.
The current theme is "Identidades" (Identities).
Keep questions concrete and short (A1–A2): family, friends, daily routine, languages, where people live, simple likes/dislikes, school basics.
Avoid abstract debate or literary register.
`,
  experiencias: `
You are an experienced IB Spanish ab initio SL oral examiner.
The current theme is "Experiencias" (Experiences).
Keep questions concrete and short (A1–A2): weekends, holidays, past trips, food, sports, birthdays, simple past events with clear time words (ayer, el fin de semana).
Avoid hypothetical chains or complex argumentation.
`,
  "ingenio-humano": `
You are an experienced IB Spanish ab initio SL oral examiner.
The current theme is "Ingenio humano" (Human ingenuity).
Keep questions concrete and short (A1–A2): phones, internet, music, TV, simple technology in daily life, studying online.
Avoid deep analysis of AI policy or specialized science.
`,
  "organizacion-social": `
You are an experienced IB Spanish ab initio SL oral examiner.
The current theme is "Organización social" (Social organization).
Keep questions concrete and short (A1–A2): school subjects, timetable, town/city, shops, transport, simple rules in public places.
Avoid political theory or economics jargon.
`,
  "compartir-el-planeta": `
You are an experienced IB Spanish ab initio SL oral examiner.
The current theme is "Compartir el planeta" (Sharing the planet).
Keep questions concrete and short (A1–A2): weather, recycling, animals, parks, simple environmental habits (water, trees, clean streets).
Avoid global policy essays.
`,
};

const AB_INITIO_BASE_INSTRUCTIONS = `
IMPORTANT INSTRUCTIONS (AB INITIO FORMAT — apply after every student answer):
1. QUESTIONS: Always ask questions in Spanish only. ONE short question per turn.
2. RESPONSE FORMAT after the student answers (exact order every time):
   a) Brief encouraging comment in Spanish (1 short sentence).
   b) ONE English tip marked with "💡" — pick ONE of:
      - Grammar: "💡 Grammar: Instead of '[error]', say '[simple correct form]' ([very short reason])"
      - Vocab: "💡 Vocab: '[word]' is OK — try '[simpler common word]' for clearer A2 Spanish"
      - Structure: "💡 Tip: Add a time word (ayer, mañana, normalmente) or a connector (y, pero, porque) to make your answer clearer"
      Skip this tip if the answer is already clear and accurate for ab initio.
   c) The next question in Spanish (one short sentence).
3. Use informal "tú". Simple vocabulary; prefer present and near past (pretérito) over subjunctive chains.
4. Do NOT require cross-theme links or "Band 6–7" skills — stay within the theme with simple follow-ups.
5. Warm up with very easy questions; increase difficulty only slightly within A2.

Begin the exam by welcoming the student warmly in Spanish and asking your first simple question about the theme. (No English tip on the opening turn.)
`;

router.post("/exam/chat", async (req, res) => {
  const { messages, theme, sessionTurn, regenerate, skip, level } = req.body as {
    messages: Array<{ role: string; content?: string }>;
    theme: string;
    sessionTurn?: number;
    regenerate?: boolean;
    skip?: boolean;
    level?: string;
  };

  if (!theme || !messages) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const themeKey = theme.toLowerCase().replace(/\s+/g, "-");
  const isAbInitio = level === "ab_initio";
  const themePrompt = isAbInitio
    ? AB_INITIO_THEME_DESCRIPTIONS[themeKey] || AB_INITIO_THEME_DESCRIPTIONS["identidades"]
    : THEME_DESCRIPTIONS[themeKey] || THEME_DESCRIPTIONS["identidades"];
  const baseInstructions = isAbInitio ? AB_INITIO_BASE_INSTRUCTIONS : BASE_INSTRUCTIONS;

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

  const systemPrompt = themePrompt + baseInstructions + regenerateInstruction + skipInstruction;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as ChatMessage["role"],
          content: m.content ?? "",
        })),
    ];

    for await (const content of streamChat(chatMessages, {
      model: "flash",
      maxOutputTokens: 1500,
    })) {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
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



router.post("/exam/image-chat", async (req, res) => {
  const { messages, theme, imageDescription, imageCaption, sessionTurn, rephrase, skip, level } =
    req.body as {
      messages: Array<{ role: string; content?: string }>;
      theme?: string;
      imageDescription?: string;
      imageCaption?: string;
      sessionTurn?: number;
      rephrase?: boolean;
      skip?: boolean;
      level?: string;
    };
  if (!messages || !imageDescription) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const themeKey = (typeof theme === "string" ? theme : "").toLowerCase().replace(/\s+/g, "-");
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
  const systemPrompt = isAbInitio
    ? `You are an experienced IB Spanish ab initio SL oral examiner using an image stimulus.

Use simple, clear Spanish suitable for A1–A2.

IMAGE DESCRIPTION:
"${imageCaption || "An image related to the stimulus"}"
${imageDescription}

THEME: ${themeName[themeKey] || "Compartir el planeta"}

MANDATORY RESPONSE FORMAT (Return ONLY JSON):
{
  "corrección": "One simple grammar or spelling fix, or '¡Texto perfecto!' if fine for ab initio.",
  "respuesta": "A very short encouraging reply in simple Spanish (A1–A2).",
  "pregunta_ib": "Exactly ONE short follow-up question in Spanish about the image/theme (concrete, simple vocabulary)."
}
${rephraseInstruction}${skipInstruction}`
    : `You are an experienced IB Spanish B oral examiner conducting a formal Individual Oral (IO) exam based on an image stimulus.

Use standard academic Spanish.

IMAGE DESCRIPTION:
"${imageCaption || "An image related to the stimulus"}"
${imageDescription}

THEME: ${themeName[themeKey] || "Compartir el planeta"}

MANDATORY RESPONSE FORMAT (Return ONLY JSON):
{
  "corrección": "Provide a specific grammar/spelling fix for the student's text. If perfect, say '¡Texto perfecto!'.",
  "respuesta": "A short level-appropriate response (using higher level B1-B2 grammar if appropriate).",
  "pregunta_ib": "Exactly ONE follow-up question strictly tied to the IB Theme."
}

ENCOURAGE PALMS:
Elicit: Point, Answer/Evidence, Link, Meaning, Structure.
Use "sin embargo", "además", "por lo tanto"${rephraseInstruction}${skipInstruction}`;

  try {
    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as ChatMessage["role"],
          content: m.content ?? "",
        })),
    ];

    const content = await completeChat(chatMessages, {
      model: "pro",
      maxOutputTokens: 1000,
      json: true,
    }) || "{}";
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Image chat error:", error);
    res.status(500).json({ error: "Error connecting to AI" });
  }
});

router.post("/exam/transcribe", async (req, res) => {
  const { audioBase64 } = req.body;

  if (!audioBase64) {
    res.status(400).json({ error: "Missing audioBase64" });
    return;
  }

  const supportedFormats = new Set([
    "wav",
    "mp3",
    "webm",
    "mp4",
    "mpeg",
    "mpga",
    "m4a",
    "ogg",
    "flac",
  ]);

  try {
    const rawBuffer = Buffer.from(audioBase64, "base64");
    const detected = detectAudioFormat(rawBuffer);
    let buffer = rawBuffer;
    let formatExt: string;

    if (detected !== "unknown" && supportedFormats.has(detected)) {
      formatExt = detected;
    } else {
      const converted = await ensureCompatibleFormat(rawBuffer);
      buffer = Buffer.from(converted.buffer);
      formatExt = converted.format;
    }

    const text = await speechToText(buffer, formatExt);
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
  const { messages, theme, level } = req.body as {
    messages?: unknown;
    theme?: string;
    level?: string;
  };

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
  const feedbackPrompt = isAbInitio
    ? `You are an experienced IB Spanish ab initio SL examiner providing feedback on a beginner oral practice session.

EXAM TRANSCRIPT:
${conversationText}

IB THEME: ${theme || "General"}

Analyse in ENGLISH. Return ONLY valid JSON with this exact structure (bands 1–7 are relative to ab initio expectations, not Spanish B):

{
  "overallComment": "2-3 sentence overall assessment for A1–A2 level",
  "languageAnalysis": {
    "grammarMistakes": [
      { "error": "exact error from transcript", "correction": "corrected version", "explanation": "simple explanation" }
    ],
    "tenseUsage": "Brief assessment: present / past / future — keep advice simple",
    "vocabularyRange": "Assessment for ab initio: survival / basic / developing A2"
  },
  "improvementSuggestions": {
    "betterStructures": ["short simple sentence patterns in Spanish", "second pattern", "third pattern"],
    "connectors": ["y, pero, porque, entonces, también…"],
    "vocabulary": ["everyday word suggestions with English meaning — not advanced literary terms"]
  },
  "ibCriteria": {
    "criterionA": { "band": 4, "label": "Language", "comments": "Grammar and vocabulary for ab initio" },
    "criterionB": { "band": 4, "label": "Message", "comments": "Clarity and relevance of simple ideas" },
    "criterionC": { "band": 4, "label": "Conceptual Understanding", "comments": "Basic engagement with the theme" },
    "criterionD": { "band": 4, "label": "Interaction", "comments": "Ability to respond simply and keep going" }
  },
  "improvedExamples": [
    { "original": "student's actual sentence", "improved": "clear simple Spanish version", "note": "brief note" }
  ]
}

Use the student's ACTUAL words where possible. Be encouraging and realistic for ab initio.`
    : `You are an experienced IB Spanish B examiner providing detailed feedback on a student's oral exam performance.

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
    "criterionC": { "band": 5, "label": "Conceptual Understanding", "comments": "Assessment of theme engagement and analysis" },
    "criterionD": { "band": 6, "label": "Interaction", "comments": "Assessment of responsiveness and conversation flow" }
  },
  "improvedExamples": [
    { "original": "student's actual sentence", "improved": "better version in Spanish", "note": "explanation of improvement" }
  ]
}

Use the student's ACTUAL words from the transcript in grammarMistakes and improvedExamples. IB bands use the official max marks. Be specific and constructive.`;

  try {
    const content = await completeChat(
      [{ role: "user", content: feedbackPrompt }],
      { model: "pro", maxOutputTokens: 2048, json: true },
    );
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
  const { messages, imageCaption, theme, level } = req.body as {
    messages?: unknown;
    imageCaption?: string;
    theme?: string;
    level?: string;
  };

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
  const feedbackPrompt = isAbInitio
    ? `You are an experienced IB Spanish ab initio SL examiner grading a short image-based oral practice.

Image: "${imageCaption || "Image-based oral"}"
Theme: ${theme || "General"}

EXAM CONVERSATION:
${conversationText}

Grade using ab initio expectations (A1–A2). Return ONLY valid JSON (scores 1–10 are fine; interpret them leniently for beginners):

{
  "criterionA": {
    "score": <1-10>,
    "label": "Lengua",
    "feedback": "Simple language accuracy, basic vocabulary, clarity — quote the student briefly."
  },
  "criterionB": {
    "score": <1-10>,
    "label": "Mensaje",
    "feedback": "Does the student describe the image with simple relevant ideas?"
  },
  "criterionC": {
    "score": <1-10>,
    "label": "Comprensión conceptual",
    "feedback": "Basic link to the IB theme in simple terms."
  },
  "criterionD": {
    "score": <1-10>,
    "label": "Interacción",
    "feedback": "Can they answer short examiner questions simply?"
  }
}

Be fair and encouraging. Grade ONLY what was actually said.`
    : `You are an experienced IB Spanish B examiner grading a student's Individual Oral (IO) based on an image stimulus.

Image: "${imageCaption || "Image-based oral"}"
Theme: ${theme || "General"}

EXAM CONVERSATION:
${conversationText}

Grade the student using the official IB Spanish B Individual Oral criteria (Standard Level or Higher Level). Return ONLY valid JSON:

{
  "criterionA": {
    "score": <1-10>,
    "label": "Lengua",
    "feedback": "2-3 sentence specific assessment of grammar accuracy, vocabulary range, register, tense variety, and sentence complexity. Reference ACTUAL quotes from the student."
  },
  "criterionB": {
    "score": <1-10>,
    "label": "Mensaje",
    "feedback": "2-3 sentence specific assessment of ideas, arguments, relevance to image, detail, examples used, and development of points."
  },
  "criterionC": {
    "score": <1-10>,
    "label": "Comprensión conceptual",
    "feedback": "2-3 sentence specific assessment of engagement with the IB theme, cultural references, cross-theme connections, and depth of analysis."
  },
  "criterionD": {
    "score": <1-10>,
    "label": "Interacción",
    "feedback": "2-3 sentence specific assessment of responsiveness to examiner questions, spontaneity, conversation flow, and ability to maintain and develop discussion."
  }
}

Be fair, constructive, and specific. Grade ONLY what was actually said. Bands range from 1–10 per criterion.`;

  try {
    const content = await completeChat(
      [{ role: "user", content: feedbackPrompt }],
      { model: "pro", maxOutputTokens: 1500, json: true },
    );
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
    const content = await completeChat(
      [
        {
          role: "system",
          content:
            "You are a Spanish language dictionary. Return only valid JSON with no markdown code blocks.",
        },
        {
          role: "user",
          content: `Spanish word: "${word}"\nContext sentence: "${(context || word).slice(0, 300)}"\n\nReturn JSON only:\n{ "phonetic": "readable syllable pronunciation like deh-sah-rroh-yoh", "meaning": "concise English meaning based on context (max 15 words)", "partOfSpeech": "noun / verb / adjective / adverb / etc" }`,
        },
      ],
      { model: "flash", maxOutputTokens: 200, json: true },
    );
    const data = JSON.parse(content || "{}");
    res.json(data);
  } catch {
    res.status(500).json({ error: "Word explanation failed" });
  }
});

export default router;
