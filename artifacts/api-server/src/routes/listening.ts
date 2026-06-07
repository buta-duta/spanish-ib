import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";
import { Buffer } from "node:buffer";
import { sendOpenAIError } from "./openaiError";
import { gradePromptFor, type AiGradeItem } from "../lib/paper";

const router: IRouter = Router();

const THEME_NAMES: Record<string, string> = {
  identidades: "Identidades",
  experiencias: "Experiencias",
  "ingenio-humano": "Ingenio humano",
  "organizacion-social": "Organización social",
  "compartir-el-planeta": "Compartir el planeta",
};

type VoiceId = "nova" | "shimmer" | "onyx" | "echo";
// OpenAI voices with clearly gendered delivery
const FEMALE_VOICES: VoiceId[] = ["nova", "shimmer"];
const MALE_VOICES: VoiceId[] = ["onyx", "echo"];
const FEMALE_NAMES = new Set([
  "alicia", "alejandra", "amalia", "ana", "andrea", "angela", "beatriz", "belen", "camila", "carmen",
  "carolina", "cecilia", "clara", "claudia", "consuelo", "cristina", "daniela", "diana", "dolores", "elena",
  "elisa", "esther", "eva", "fatima", "gabriela", "gema", "gloria", "ines", "inmaculada", "irene",
  "isabel", "jimena", "julia", "laura", "leticia", "lola", "lourdes", "lucia", "lucrecia", "magdalena",
  "manuela", "marcela", "margarita", "maria", "marina", "marta", "mercedes", "milagros", "monica",
  "natalia", "nicole", "noelia", "nuria", "olga", "paloma", "patricia", "paula", "penelope", "pilar",
  "purificacion", "pura", "raquel", "rebeca", "regina", "remedios", "rocio", "rosa", "rosario", "sara",
  "silvia", "sofia", "soledad", "sonia", "susana", "teresa", "valeria", "veronica", "victoria", "yolanda",
]);
const MALE_NAMES = new Set([
  "adrian", "agustin", "alberto", "alejandro", "alfonso", "alvaro", "andres", "angel", "antonio", "braulio",
  "carlos", "cesar", "cristobal", "daniel", "david", "diego", "eduardo", "emilio", "enrique", "ernesto",
  "fabian", "felipe", "fernando", "francisco", "gonzalo", "guillermo", "hector", "hugo", "ignacio", "ivan",
  "jaime", "javier", "jesus", "joaquin", "jorge", "jose", "juan", "julio", "lorenzo", "lucas", "luis",
  "manuel", "marcos", "mariano", "mario", "martin", "mateo", "miguel", "nicolas", "oscar", "pablo",
  "pedro", "rafael", "ramon", "raul", "ricardo", "roberto", "rodrigo", "ruben", "samuel", "santos",
  "sergio", "tomas", "victor",
]);
// Rare Spanish male first names ending in -a
const MALE_NAMES_ENDING_A = new Set(["bautista", "luca", "maikel", "mika", "mustafa", "nazaret"]);

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

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function cleanSpeakerLabel(speaker: string): string {
  return speaker
    .replace(/^\s*(?:sr\.?|sra\.?|srta\.?|don|doña|d\.)\s+/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function genderFromLabelHints(raw: string): "female" | "male" | null {
  if (/\(mujer\)|\(f\)|\bfemenin|\bmujer\b|\bseñora\b|\bseñorita\b|\bchica\b|\bama\b|\bactriz\b|\bdirectora\b|\bentrevistada\b|\blocutora\b|\bpresentadora\b|\bnarradora\b|\binvitada\b/.test(raw)) {
    return "female";
  }
  if (/\(hombre\)|\(m\)|\bmasculin|\bhombre\b|\bseñor\b|\bchico\b|\bactor\b|\bdirector\b|\bentrevistador\b|\blocutor\b|\bpresentador\b|\bnarrador\b|\binvitado\b/.test(raw)) {
    return "male";
  }
  return null;
}

function extractSpeakerFirstName(speaker: string): string {
  const cleaned = cleanSpeakerLabel(speaker);
  const trimmed = cleaned.trim();
  const roleWithName = trimmed.match(
    /^(?:entrevistador|entrevistadora|invitado|invitada|locutor|locutora|presentador|presentadora|narrador|narradora)(?:\/a)?\s+(.+)$/i,
  );
  if (roleWithName?.[1]) {
    return normalizeToken(roleWithName[1].split(/\s+/)[0] ?? "");
  }
  return normalizeToken(trimmed.split(/\s+/)[0] ?? "");
}

function speakerGender(speaker: string): "female" | "male" {
  const raw = speaker
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const hint = genderFromLabelHints(raw);
  if (hint) return hint;

  if (/entrevistadora|invitada|locutora|presentadora|narradora/.test(raw)) return "female";
  if (/entrevistador\/a|invitado\/a|locutor\/a|presentador\/a|narrador\/a/.test(raw)) {
    const name = extractSpeakerFirstName(speaker);
    return name ? genderFromFirstName(name) : "male";
  }
  if (/entrevistador|invitado|locutor|presentador|narrador/.test(raw)) {
    const name = extractSpeakerFirstName(speaker);
    if (name) return genderFromFirstName(name);
    return "male";
  }

  const firstName = extractSpeakerFirstName(speaker);
  if (!firstName) return "male";
  return genderFromFirstName(firstName);
}

function genderFromFirstName(name: string): "female" | "male" {
  if (FEMALE_NAMES.has(name)) return "female";
  if (MALE_NAMES.has(name) || MALE_NAMES_ENDING_A.has(name)) return "male";
  if (name.endsWith("a") && !name.endsWith("ia") && name.length > 3) return "female";
  if (name.endsWith("o")) return "male";
  return "male";
}

function voiceForSpeaker(speaker: string, speakerVoiceMap: Map<string, VoiceId>): VoiceId {
  const existing = speakerVoiceMap.get(speaker);
  if (existing) return existing;

  const pool = speakerGender(speaker) === "female" ? FEMALE_VOICES : MALE_VOICES;
  const usedFromPool = [...speakerVoiceMap.values()].filter((v) => pool.includes(v)).length;
  const voice = pool[usedFromPool % pool.length];
  speakerVoiceMap.set(speaker, voice);
  return voice;
}

function mergeConsecutiveSegments(segments: DialogueSeg[]): DialogueSeg[] {
  if (segments.length === 0) return [];
  const merged: DialogueSeg[] = [{ ...segments[0] }];
  for (let i = 1; i < segments.length; i++) {
    const prev = merged[merged.length - 1];
    if (segments[i].speaker === prev.speaker) {
      prev.text += " " + segments[i].text;
    } else {
      merged.push({ ...segments[i] });
    }
  }
  return merged;
}

async function ttsWithRetry(text: string, voice: VoiceId, retries = 2): Promise<Buffer> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const buf = await textToSpeech(text, voice, "mp3");
      if (buf.length < 100) throw new Error("Empty TTS audio");
      return buf;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
    conversation: `FORMAT: A natural dialogue between 2 people. Label each turn clearly as:\nNombre: [text]\nUse realistic Spanish first names with clear gender (e.g. Lucía, Carlos). Include natural fillers: bueno, pues, eh..., mira, oye. Aim for 6-10 turns each.`,
    interview: `FORMAT: A radio/podcast interview. Use gender-consistent labels:\nEntrevistadora [name]: or Entrevistador [name]: [text]\nInvitada [name]: or Invitado [name]: [text]\nMatch role gender to the speaker's name (never Entrevistador Lucía). The interviewer asks probing questions; the guest gives detailed answers.`,
    monologue: `FORMAT: A single speaker narrating in first person. A personal story, reflection, or account. Include natural spoken-language features: repetition, self-correction, filler words.`,
    news: `FORMAT: A news broadcast. One or two presenters with gender-consistent names (Presentadora Ana / Presentador Carlos). May include a short "on location" report segment. Formal register.`,
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
      const segments = parseDialogue(passage);
      const speakers = new Set(segments.map((s) => s.speaker));
      const voiceMap = new Map<string, VoiceId>();
      const voice =
        speakers.size === 1 && segments[0]
          ? voiceForSpeaker(segments[0].speaker, voiceMap)
          : "onyx";
      const audioBuffer = await ttsWithRetry(passage.trim(), voice);
      res.json({ audioBase64: audioBuffer.toString("base64"), isDualVoice: false });
      return;
    }

    // Dialogue: multi-voice — merge same-speaker turns, limited parallel TTS
    const segments = mergeConsecutiveSegments(parseDialogue(passage));
    const speakerVoiceMap = new Map<string, VoiceId>();

    for (const seg of segments) {
      voiceForSpeaker(seg.speaker, speakerVoiceMap);
    }

    const segmentBuffers = await mapWithConcurrency(segments, 3, (seg) =>
      ttsWithRetry(seg.text, voiceForSpeaker(seg.speaker, speakerVoiceMap)),
    );

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
  const { passage, count = 6, focusTypes, flashcardWords } = req.body as {
    passage?: string;
    count?: number;
    focusTypes?: string[];
    flashcardWords?: string[];
  };
  if (!passage) { res.status(400).json({ error: "Missing passage" }); return; }

  const allowed = focusTypes?.length
    ? [...new Set(focusTypes)]
    : ["multiple-choice", "true-false", "short-answer", "detail", "inference"];
  const perType = Math.max(1, Math.floor(count / allowed.length));
  const typeLines = allowed.map((t) => `- ${perType} × ${t}`).join("\n");
  const vocabLine = flashcardWords?.length
    ? `\nWhere natural, include or test these saved vocabulary words: ${flashcardWords.slice(0, 20).join(", ")}.`
    : "";

  const prompt = `Eres un examinador del IB Spanish B. Genera ${count} preguntas de comprensión auditiva basadas en este texto:

---
${passage}
---

Genera SOLO estos tipos de pregunta (práctica de tipos débiles del examen completo):
${typeLines}
${vocabLine}

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
  const { theme, customFocus, previousTopics } = req.body as {
    theme?: string;
    customFocus?: string;
    previousTopics?: string[];
  };
  const themeKey = (theme || "identidades").toLowerCase().replace(/\s+/g, "-");
  const themeName = THEME_NAMES[themeKey] || "Identidades";
  const focusLine = customFocus?.trim()
    ? `\n- Enfoque: incorpora de forma natural "${customFocus.trim()}"`
    : "";
  const avoidLine =
    Array.isArray(previousTopics) && previousTopics.length
      ? `\n\nNO repitas estos casos/títulos de exámenes anteriores — crea audios y preguntas completamente diferentes:\n${previousTopics.slice(-10).map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}`
      : "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 5000,
      messages: [
        {
          role: "system",
          content: `Eres un examinador del IB Spanish B (Prueba 1, Comprensión auditiva). Crea un examen completo de práctica con TRES textos distintos (Texto A, B, C), cada uno con su transcripción y preguntas. Debe seguir EXACTAMENTE la estructura de numeración y formatos indicados abajo.

Nivel: B1-B2. Tema general orientativo: "${themeName}".${focusLine}${avoidLine}
- El examen muestra 20 preguntas numeradas del 1 al 20.
- Texto A: 4 preguntas numeradas (1-4), con la pregunta 3 pidiendo dos ejemplos (a) y (b). Debe tener contenido suficiente para responder 5 puntos de información.
- Texto B: preguntas 5-14. Las preguntas 5-9 son de opción múltiple A/B/C. Las preguntas 10-14 son un cloze con cinco huecos [ – 10 – ] a [ – 14 – ].
- Texto C: preguntas 15-20. Las preguntas 15-19 son de opción múltiple A/B/C. La pregunta 20 es "Elige las cinco frases verdaderas. [5]" con opciones A-J.
- Adapta longitud y dificultad al número de preguntas: Texto A 170-230 palabras, Texto B 280-360 palabras, Texto C 320-420 palabras.
- Para diálogos usa siempre etiquetas "Nombre: texto". Si asignas nombres con género claro (Lucía, María, Rocío, Carlos, Juan, Ernesto), el audio usará una voz acorde al género.
- NO uses heading-match, referent, true-false-justify, gap-fill-bank, find-word ni sentence-completion en listening full practice.

Devuelve SOLO JSON válido con esta forma EXACTA:
{
  "texts": [
    {
      "id": "A",
      "label": "Texto A",
      "title": "Título corto",
      "context": "Vas a escuchar...",
      "body": "Transcripción completa con etiquetas de hablante si hay diálogo",
      "blocks": [
        {
          "type": "short-answer",
          "instruction": "Contesta a las siguientes preguntas.",
          "items": [
            { "id": "a1", "number": "1", "question": "¿En qué ...?", "answer": "respuesta esperada", "explanation": "evidencia breve" },
            { "id": "a2", "number": "2", "question": "¿Cuánto tiempo ...?", "answer": "respuesta esperada", "explanation": "evidencia breve" },
            { "id": "a3", "number": "3", "question": "¿De dónde reciben dinero...? Da dos ejemplos.\\n(a)\\n(b)", "answer": "dos fuentes aceptables separadas por punto y coma", "explanation": "evidencia breve" },
            { "id": "a4", "number": "4", "question": "¿Cuál es la mejor forma de ...?", "answer": "respuesta esperada", "explanation": "evidencia breve" }
          ]
        }
      ]
    },
    {
      "id": "B",
      "label": "Texto B",
      "title": "Título corto",
      "context": "Vas a escuchar...",
      "body": "Transcripción completa",
      "blocks": [
        {
          "type": "multiple-choice",
          "instruction": "Elige la respuesta correcta.",
          "items": [
            { "id": "b5", "number": "5", "question": "Según ..., ¿...?", "options": ["A. ...", "B. ...", "C. ..."], "answer": "A", "explanation": "evidencia breve" },
            { "id": "b6", "number": "6", "question": "Según ..., ¿...?", "options": ["A. ...", "B. ...", "C. ..."], "answer": "B", "explanation": "evidencia breve" },
            { "id": "b7", "number": "7", "question": "¿En qué tipo de eventos ...?", "options": ["A. ...", "B. ...", "C. ..."], "answer": "C", "explanation": "evidencia breve" },
            { "id": "b8", "number": "8", "question": "Según ..., ¿qué función ...?", "options": ["A. ...", "B. ...", "C. ..."], "answer": "A", "explanation": "evidencia breve" },
            { "id": "b9", "number": "9", "question": "¿Qué efecto tendrá ...?", "options": ["A. ...", "B. ...", "C. ..."], "answer": "B", "explanation": "evidencia breve" }
          ]
        },
        {
          "type": "cloze-max3",
          "instruction": "Completa los espacios en blanco. Usa como máximo tres palabras por espacio.",
          "intro": "Texto breve con huecos [ – 10 – ], [ – 11 – ], [ – 12 – ], [ – 13 – ], [ – 14 – ].",
          "items": [
            { "id": "b10", "number": "10", "stem": "[ – 10 – ]", "answer": "máximo tres palabras", "explanation": "evidencia breve" },
            { "id": "b11", "number": "11", "stem": "[ – 11 – ]", "answer": "máximo tres palabras", "explanation": "evidencia breve" },
            { "id": "b12", "number": "12", "stem": "[ – 12 – ]", "answer": "máximo tres palabras", "explanation": "evidencia breve" },
            { "id": "b13", "number": "13", "stem": "[ – 13 – ]", "answer": "máximo tres palabras", "explanation": "evidencia breve" },
            { "id": "b14", "number": "14", "stem": "[ – 14 – ]", "answer": "máximo tres palabras", "explanation": "evidencia breve" }
          ]
        }
      ]
    },
    {
      "id": "C",
      "label": "Texto C",
      "title": "Título corto",
      "context": "Vas a escuchar...",
      "body": "Transcripción completa",
      "blocks": [
        {
          "type": "multiple-choice",
          "instruction": "Elige la respuesta correcta.",
          "items": [
            { "id": "c15", "number": "15", "question": "...", "options": ["A. ...", "B. ...", "C. ..."], "answer": "A", "explanation": "evidencia breve" },
            { "id": "c16", "number": "16", "question": "...", "options": ["A. ...", "B. ...", "C. ..."], "answer": "B", "explanation": "evidencia breve" },
            { "id": "c17", "number": "17", "question": "...", "options": ["A. ...", "B. ...", "C. ..."], "answer": "C", "explanation": "evidencia breve" },
            { "id": "c18", "number": "18", "question": "...", "options": ["A. ...", "B. ...", "C. ..."], "answer": "A", "explanation": "evidencia breve" },
            { "id": "c19", "number": "19", "question": "...", "options": ["A. ...", "B. ...", "C. ..."], "answer": "B", "explanation": "evidencia breve" }
          ]
        },
        {
          "type": "choose-5-true",
          "number": "20",
          "instruction": "Elige las cinco frases verdaderas. [5]",
          "options": [
            { "letter": "A", "text": "..." }, { "letter": "B", "text": "..." }, { "letter": "C", "text": "..." }, { "letter": "D", "text": "..." }, { "letter": "E", "text": "..." },
            { "letter": "F", "text": "..." }, { "letter": "G", "text": "..." }, { "letter": "H", "text": "..." }, { "letter": "I", "text": "..." }, { "letter": "J", "text": "..." }
          ],
          "answers": ["A", "E", "G", "I", "J"]
        }
      ]
    }
  ]
}

Phrasing constraints:
- Use the exact instructions: "Contesta a las siguientes preguntas.", "Elige la respuesta correcta.", "Completa los espacios en blanco. Usa como máximo tres palabras por espacio.", "Elige las cinco frases verdaderas. [5]".
- The content of all questions/options must change to match the generated audio text.
- Keep all questions and options in Spanish.
- Every answer must be directly supported by the corresponding transcript.
- Ensure the visible numbers are exactly 1 through 20 and no extra numbered questions are added.`,
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
