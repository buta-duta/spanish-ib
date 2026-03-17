import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";
import { Buffer } from "node:buffer";

const router: IRouter = Router();

const THEME_NAMES: Record<string, string> = {
  identidades: "Identidades",
  experiencias: "Experiencias",
  "ingenio-humano": "Ingenio humano",
  "organizacion-social": "Organización social",
  "compartir-el-planeta": "Compartir el planeta",
};

const VOICES = ["nova", "onyx", "shimmer", "alloy", "echo", "fable"] as const;
type VoiceId = typeof VOICES[number];

// ── Silent MP3 generator ─────────────────────────────────────────────────────
// Creates valid MPEG1 Layer3 frames filled with zeros (silence).
// Avoids sending punctuation-only text to TTS which causes the model to
// generate spoken apology messages instead of silence.
function createSilentMp3(durationMs: number): Buffer {
  // MPEG1, Layer3, 128 kbps, 44100 Hz, mono
  // Frame size = floor(144 * 128000 / 44100) = 417 bytes
  // One frame covers 1152 samples → ~26.12 ms
  const FRAME_SIZE = 417;
  const MS_PER_FRAME = (1152 / 44100) * 1000; // ~26.12
  const frames = Math.max(1, Math.ceil(durationMs / MS_PER_FRAME));
  const buf = Buffer.alloc(frames * FRAME_SIZE, 0);
  for (let i = 0; i < frames; i++) {
    const o = i * FRAME_SIZE;
    buf[o + 0] = 0xFF; // sync word high byte
    buf[o + 1] = 0xFB; // sync(4b) + MPEG1(2b) + Layer3(2b) + no-CRC(1b)
    buf[o + 2] = 0x90; // 128kbps(4b) + 44100Hz(2b) + no-padding(1b) + private(1b)
    buf[o + 3] = 0xC4; // mono(2b) + mode_ext(2b) + not-copyrighted + original + no-emphasis(2b)
  }
  return buf;
}

// ── Dialogue detection + parsing (F40) ───────────────────────────────────────
function isDialogue(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim());
  const dialogueLines = lines.filter((l) => /^[A-ZÁ-Úa-zá-ú][^:]{0,30}:\s/.test(l));
  return dialogueLines.length >= 2;
}

type DialogueSeg = { speaker: string; text: string };

function parseDialogue(text: string): DialogueSeg[] {
  const lines = text.split("\n");
  const segments: DialogueSeg[] = [];
  let currentSpeaker = "";
  let currentText = "";

  const flush = () => {
    if (currentText.trim()) {
      segments.push({ speaker: currentSpeaker, text: currentText.trim() });
      currentText = "";
    }
  };

  for (const line of lines) {
    const match = line.match(/^([A-ZÁ-Úa-zá-ú][^:]{0,30}):\s+(.+)$/);
    if (match) {
      flush();
      currentSpeaker = match[1].trim();
      currentText = match[2];
    } else if (currentSpeaker && line.trim()) {
      currentText += " " + line.trim();
    } else if (!currentSpeaker && line.trim()) {
      flush();
      currentSpeaker = "Narrador";
      currentText = line.trim();
    }
  }
  flush();
  return segments.filter((s) => s.text.length > 0);
}

// ── Generate passage (F35) ────────────────────────────────────────────────────
router.post("/listening/passage", async (req, res) => {
  const { theme, passageType, customFocus } = req.body;
  const themeKey = (theme || "identidades").toLowerCase().replace(/\s+/g, "-");
  const themeName = THEME_NAMES[themeKey] || "Identidades";
  const type = passageType || "conversation";
  const focusLine = customFocus?.trim()
    ? `\n- Custom focus: Naturally incorporate the following vocabulary, topics, or grammar into the passage: "${customFocus.trim()}"`
    : "";

  const formatInstructions: Record<string, string> = {
    conversation: `FORMAT: A natural dialogue between 2 people. Label each turn clearly as:\nNombre A: [text]\nNombre B: [text]\nUse realistic Spanish first names. Include natural fillers: bueno, pues, eh..., mira, oye. Aim for 6-10 turns each.`,
    interview: `FORMAT: A radio/podcast interview. Label turns as:\nEntrevistador/a: [text]\nInvitado/a [name]: [text]\nThe interviewer asks probing questions; the guest gives detailed answers. Include at least one follow-up question.`,
    monologue: `FORMAT: A single speaker narrating in first person. A personal story, reflection, or account. Include natural spoken-language features: repetition, self-correction, filler words.`,
    news: `FORMAT: A news broadcast. One or two presenters. May include a short "on location" report segment. Formal register. Dates, statistics, and names may be included.`,
  };

  const prompt = `Generate an IB Spanish B listening passage for the theme "${themeName}".

${formatInstructions[type] || formatInstructions.conversation}

Content guidelines:
- Spanish level: B2-C1 (IB Spanish B Higher Level)
- Length: 220–350 words (spoken words only, excluding speaker labels)
- Theme content: Explore a specific aspect of "${themeName}" with depth
- Include cultural references relevant to Spanish-speaking countries
- Use varied tenses: present, preterite, imperfect, conditional, subjunctive where natural
- Make the content engaging and exam-realistic${focusLine}

Return ONLY valid JSON (no markdown):
{
  "title": "Short descriptive title (max 8 words, in Spanish)",
  "context": "One sentence in Spanish setting the scene for the listener",
  "passage": "The complete passage text, ready to be read aloud. For dialogues, include speaker labels on separate lines.",
  "passageType": "${type}",
  "wordCount": <approximate word count as number>
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty response" }); return; }
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Passage generation error:", error);
    res.status(500).json({ error: "Passage generation failed" });
  }
});

// ── TTS with multi-voice dialogue and pauses (F40) ─────────────────────────────
router.post("/listening/tts", async (req, res) => {
  const { passage } = req.body;
  if (!passage) { res.status(400).json({ error: "Missing passage" }); return; }

  try {
    if (!isDialogue(passage)) {
      // Single narrator voice for monologue/news
      const audioBuffer = await textToSpeech(passage.trim(), "shimmer", "mp3");
      res.json({ audioBase64: audioBuffer.toString("base64"), isDualVoice: false });
      return;
    }

    // Dialogue: multi-voice with pauses (F40)
    const segments = parseDialogue(passage);
    const speakerVoiceMap = new Map<string, VoiceId>();
    let voiceIdx = 0;

    for (const seg of segments) {
      if (!speakerVoiceMap.has(seg.speaker)) {
        speakerVoiceMap.set(seg.speaker, VOICES[voiceIdx % VOICES.length]);
        voiceIdx++;
      }
    }

    // Generate all segment audios + pauses IN PARALLEL (fast)
    const segmentPromises = segments.map((seg) =>
      textToSpeech(seg.text, speakerVoiceMap.get(seg.speaker) ?? "shimmer", "mp3")
    );

    const segmentBuffers = await Promise.all(segmentPromises);

    // Concatenate segments directly — OpenAI TTS already has natural trailing
    // silence in each clip so no explicit gap audio is needed.
    // (Injecting hand-crafted MP3 frames caused decoders to terminate early.)
    const combined = Buffer.concat(segmentBuffers);
    res.json({
      audioBase64: combined.toString("base64"),
      isDualVoice: speakerVoiceMap.size >= 2,
      speakerCount: speakerVoiceMap.size,
    });
  } catch (error) {
    console.error("Listening TTS error:", error);
    res.status(500).json({ error: "TTS generation failed" });
  }
});

// ── Generate IB comprehension questions (F36) ─────────────────────────────────
router.post("/listening/questions", async (req, res) => {
  const { passage, count = 6 } = req.body;
  if (!passage) { res.status(400).json({ error: "Missing passage" }); return; }

  const prompt = `You are an IB Spanish B examiner. Generate ${count} listening comprehension questions based on this passage:

---
${passage}
---

Create a balanced mix of these question types:
- multiple-choice (2-3 options A/B/C/D)
- true-false (with justification)
- short-answer (factual detail from the text)
- detail (specific information)
- inference (reading between the lines)

Guidelines:
- Questions should be in ENGLISH (as in real IB exams)
- Answers should be findable in the text (no opinion questions)
- Vary difficulty: start accessible, end challenging
- For multiple-choice: make distractors plausible

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Question text in English",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A) ...",
      "explanation": "Brief explanation citing text evidence"
    },
    {
      "id": "q2",
      "type": "true-false",
      "question": "Statement to evaluate as True or False",
      "options": ["True", "False"],
      "correctAnswer": "True",
      "explanation": "Quote or paraphrase from text that confirms/denies"
    },
    {
      "id": "q3",
      "type": "short-answer",
      "question": "Specific detail question",
      "correctAnswer": "Expected answer (key words acceptable)",
      "explanation": "Explanation and accepted variations"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty response" }); return; }
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Questions generation error:", error);
    res.status(500).json({ error: "Questions generation failed" });
  }
});

// ── Check answer (F37) ────────────────────────────────────────────────────────
router.post("/listening/check", async (req, res) => {
  const { question, questionType, studentAnswer, correctAnswer, explanation, passage } = req.body;
  if (!question || !studentAnswer) { res.status(400).json({ error: "Missing fields" }); return; }

  const prompt = `You are an IB Spanish B examiner marking a listening comprehension answer.

Question: "${question}"
Question type: ${questionType || "short-answer"}
Student's answer: "${studentAnswer}"
Correct answer: "${correctAnswer}"
Explanation from mark scheme: "${explanation}"

Is the student's answer correct? For short-answer and detail questions, accept semantic equivalence — key facts are sufficient, exact wording is not required. For multiple-choice and true-false, require the exact letter/word.

Return ONLY valid JSON:
{
  "correct": true,
  "feedback": "Brief, specific feedback (1-2 sentences). If correct, affirm and add a small insight. If incorrect, explain what the right answer is and why."
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 200,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty response" }); return; }
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Answer check error:", error);
    res.status(500).json({ error: "Answer check failed" });
  }
});

export default router;
