import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";
import { Buffer } from "node:buffer";
import { sendOpenAIError } from "./openaiError";
import { paperSchemaInstructions, gradePromptFor, type AiGradeItem } from "../lib/paper";

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
- Use appropriate tenses: present, preterite, imperfect, conditional, subjunctive where natural
- Make the content engaging and exam-realistic${focusLine}
- STRICTLY adhere to the specified level constraints. Do not exceed the complexity of the target level.

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
      model: "gpt-4o",
      max_completion_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty response" }); return; }
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Passage generation error:", error);
    return sendOpenAIError(res, error, "Passage generation failed");
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
    return sendOpenAIError(res, error, "TTS generation failed");
  }
});

// ── Generate IB comprehension questions (F36) ─────────────────────────────────
router.post("/listening/questions", async (req, res) => {
  const { passage, count = 6 } = req.body;
  if (!passage) { res.status(400).json({ error: "Missing passage" }); return; }

  const prompt = `Eres un examinador del IB Spanish B. Genera ${count} preguntas de comprensión auditiva basadas en este texto:

---
${passage}
---

Crea una mezcla equilibrada de estos tipos de preguntas:
- multiple-choice (opciones A/B/C/D)
- true-false (con justificación)
- short-answer (detalle factual del texto)
- detail (información específica)
- inference (inferencia a partir del contexto)

Directrices:
- TODAS las preguntas y opciones deben estar en ESPAÑOL
- Las respuestas deben estar en el texto (sin preguntas de opinión)
- Varía la dificultad: empieza accesible, termina desafiante
- Para opción múltiple: los distractores deben ser plausibles
- Para verdadero/falso: usa "Verdadero" y "Falso" como opciones
- Use standard academic Spanish for questions.

Devuelve SOLO JSON válido:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Texto de la pregunta en español",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A) ...",
      "explanation": "Breve explicación citando evidencia del texto"
    },
    {
      "id": "q2",
      "type": "true-false",
      "question": "Afirmación para evaluar como Verdadero o Falso",
      "options": ["Verdadero", "Falso"],
      "correctAnswer": "Verdadero",
      "explanation": "Cita o paráfrasis del texto que confirma o niega"
    },
    {
      "id": "q3",
      "type": "short-answer",
      "question": "Pregunta sobre un detalle específico",
      "correctAnswer": "Respuesta esperada (palabras clave aceptables)",
      "explanation": "Explicación y variaciones aceptadas"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1500,
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty response" }); return; }
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Questions generation error:", error);
    return sendOpenAIError(res, error, "Questions generation failed");
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
      model: "gpt-4o",
      max_completion_tokens: 200,
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty response" }); return; }
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Answer check error:", error);
    return sendOpenAIError(res, error, "Answer check failed");
  }
});

// ── Full IB listening exam paper: 3 audio texts (Texto A/B/C) ─────────────────
router.post("/listening/paper", async (req, res) => {
  const { theme, customFocus } = req.body;
  const themeKey = (theme || "identidades").toLowerCase().replace(/\s+/g, "-");
  const themeName = THEME_NAMES[themeKey] || "Identidades";
  const focusLine = customFocus?.trim()
    ? `\n- Enfoque: incorpora de forma natural "${customFocus.trim()}"`
    : "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `Eres un examinador del IB Spanish B (Prueba 1, Comprensión auditiva). Crea un examen completo de audio con TRES textos distintos (Texto A, B, C), cada uno con su transcripción para leer en voz alta y sus propios bloques de preguntas, imitando un examen real.

Nivel: B1-B2. Tema general orientativo: "${themeName}".${focusLine}
- Texto A: una conversación entre dos personas (usa "Nombre: texto" por turno).
- Texto B: un programa de radio / entrevista (incluye un bloque cloze-max3 con el texto de un anuncio).
- Texto C: un monólogo o testimonio personal.
- Cada texto: 180-280 palabras habladas y 2-4 bloques de tipos DISTINTOS.
- Usa SOBRE TODO opción múltiple (A/B/C), short-answer, cloze-max3 y choose-5-true (como el examen real de audio). NO uses heading-match ni referent.

${paperSchemaInstructions("listening")}`,
        },
        { role: "user", content: `Genera el examen de audio sobre "${themeName}".` },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "Empty response" }); return; }
    const parsed = JSON.parse(content);
    res.json({ texts: parsed.texts ?? [] });
  } catch (error) {
    console.error("Listening paper error:", error);
    return sendOpenAIError(res, error, "Error al generar el examen de audio.");
  }
});

// ── Batch grade free-text listening answers ───────────────────────────────────
router.post("/listening/grade", async (req, res) => {
  const { items } = req.body as { items: AiGradeItem[] };
  if (!Array.isArray(items) || items.length === 0) {
    res.json({ results: [] });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1500,
      temperature: 0.1,
      messages: [
        { role: "system", content: gradePromptFor("listening") },
        { role: "user", content: JSON.stringify({ items }) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    res.json({ results: parsed.results ?? [] });
  } catch (error) {
    console.error("Listening grade error:", error);
    return sendOpenAIError(res, error, "Error al corregir las respuestas.");
  }
});

export default router;
