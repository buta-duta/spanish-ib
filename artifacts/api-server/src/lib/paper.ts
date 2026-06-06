// Shared IB Spanish B "paper" model for reading + listening full-exam mode.
// A paper has 3 texts (Texto A/B/C); each text owns a mix of question blocks
// whose instructions use the exact IB phrasing while the content varies.

export type BlockType =
  | "short-answer"
  | "multiple-choice"
  | "gap-fill-bank"
  | "heading-match"
  | "find-word"
  | "sentence-completion"
  | "choose-5-true"
  | "true-false-justify"
  | "referent"
  | "cloze-max3";

export type BankOption = { letter: string; text: string };

export type QuestionBlock = {
  type: BlockType;
  instruction: string;
  intro?: string; // optional contextual lead-in (e.g. the cloze advert text)
  // Shared option bank for heading-match / gap-fill-bank / choose-5-true
  options?: BankOption[];
  // Correct letters for choose-5-true (exactly 5)
  answers?: string[];
  items?: QuestionItem[];
};

export type QuestionItem = {
  id: string;
  // Display fields (only the relevant ones are populated per block type)
  question?: string; // short-answer, multiple-choice
  options?: string[]; // multiple-choice display options ("A. ...")
  clue?: string; // find-word meaning clue
  stem?: string; // sentence-completion / gap-fill-bank / cloze label
  statement?: string; // true-false-justify statement
  phrase?: string; // referent underlined phrase
  // Answer key
  answer: string; // canonical correct answer (letter or text)
  justification?: string; // expected justification for true-false-justify
  explanation?: string;
};

export type PaperText = {
  id: string; // "A" | "B" | "C"
  label: string; // "Texto A"
  title: string;
  context?: string; // listening scene-setting line
  body: string; // reading text OR listening transcript
  blocks: QuestionBlock[];
};

export type Paper = { texts: PaperText[] };

// ── Free-text fields that require AI grading ──────────────────────────────────
export const AI_GRADED_TYPES: BlockType[] = [
  "short-answer",
  "find-word",
  "sentence-completion",
  "referent",
  "cloze-max3",
];

// ── JSON schema description injected into generation prompts ───────────────────
export function paperSchemaInstructions(skill: "reading" | "listening"): string {
  const bodyLabel =
    skill === "listening"
      ? `"body": the FULL spoken transcript to be read aloud (for dialogues use "Nombre: texto" lines)`
      : `"body": the full reading text, paragraphs separated by \\n\\n`;
  const contextLine =
    skill === "listening"
      ? `\n  "context": "Una frase que presenta la escena (p. ej. 'Vas a escuchar una conversación entre...')",`
      : "";

  return `Devuelve SOLO JSON válido con esta forma EXACTA:
{
  "texts": [
    {
      "id": "A",
      "label": "Texto A",
      "title": "Título corto en español",${contextLine}
      ${bodyLabel},
      "blocks": [ <2 a 4 bloques de preguntas> ]
    },
    { "id": "B", "label": "Texto B", ... },
    { "id": "C", "label": "Texto C", ... }
  ]
}

Cada bloque usa la fraseología EXACTA del IB en "instruction" y uno de estos formatos:

1) short-answer
{ "type":"short-answer", "instruction":"Contesta a las siguientes preguntas.",
  "items":[ {"id":"a1","question":"¿...?","answer":"respuesta esperada","explanation":"breve"} ] }

2) multiple-choice (3 o 4 opciones)
{ "type":"multiple-choice", "instruction":"Elige la respuesta correcta.",
  "items":[ {"id":"a2","question":"¿...?","options":["A. ...","B. ...","C. ..."],"answer":"A","explanation":"breve"} ] }

3) gap-fill-bank (banco de palabras compartido; "stem" = etiqueta del hueco)
{ "type":"gap-fill-bank", "instruction":"Elige de la lista la palabra apropiada para completar cada espacio en el siguiente texto.",
  "intro":"Texto con huecos [ – 1 – ] ... [ – 2 – ] ...",
  "options":[ {"letter":"A","text":"reservas"}, {"letter":"B","text":"demandas"} ],
  "items":[ {"id":"b1","stem":"[ – 1 – ]","answer":"D","explanation":"breve"} ] }

4) heading-match (subtítulos)
{ "type":"heading-match", "instruction":"Elige de la lista el subtítulo apropiado para completar cada espacio en el texto.",
  "options":[ {"letter":"A","text":"Te ayuda a obtener un mejor empleo"} ],
  "items":[ {"id":"c1","stem":"[ – 4 – ]","answer":"A","explanation":"breve"} ] }

5) find-word (sinónimo/expresión por significado)
{ "type":"find-word", "instruction":"Encuentra la palabra o expresión en los párrafos X que signifique lo siguiente:",
  "items":[ {"id":"d1","clue":"ofertas de trabajo","answer":"palabra del texto","explanation":"breve"} ] }

6) sentence-completion (completar con palabras tal como aparecen)
{ "type":"sentence-completion", "instruction":"Encuentra las palabras que completen las siguientes oraciones. Utiliza las palabras tal como aparecen en los párrafos 1 y 2.",
  "items":[ {"id":"e1","stem":"Las mejores condiciones ... determinan…","answer":"continuación tomada del texto","explanation":"breve"} ] }

7) choose-5-true (marcar las 5 verdaderas, opciones A–J)
{ "type":"choose-5-true", "instruction":"Elige las cinco frases verdaderas.",
  "options":[ {"letter":"A","text":"..."}, ... 8 a 10 opciones ],
  "answers":["B","E","F","I","J"] }

8) true-false-justify
{ "type":"true-false-justify", "instruction":"Las siguientes frases son verdaderas o falsas. Marca la opción correcta y luego justifícala usando las palabras tal como aparecen en el texto. Las dos partes son necesarias para obtener [1 punto].",
  "items":[ {"id":"f1","statement":"...","answer":"Falso","justification":"cita del texto","explanation":"breve"} ] }

9) referent (palabras subrayadas)
{ "type":"referent", "instruction":"¿A quién o a qué se refieren las palabras subrayadas? Contesta usando las palabras tal como aparecen en el texto.",
  "items":[ {"id":"g1","phrase":"…con el que… (línea 6)","answer":"referente del texto","explanation":"breve"} ] }

10) cloze-max3 (SOLO listening: completar con máx. 3 palabras)
{ "type":"cloze-max3", "instruction":"Completa los espacios en blanco. Usa como máximo tres palabras por espacio.",
  "intro":"Texto del anuncio con huecos [ – 10 – ] ... [ – 11 – ] ...",
  "items":[ {"id":"h1","stem":"[ – 10 – ]","answer":"respuesta breve","explanation":"breve"} ] }

Reglas:
- TODO el contenido en ESPAÑOL (las "explanation" pueden ser breves en español).
- Todas las respuestas deben poder deducirse del texto correspondiente.
- "id" únicos en TODO el examen (p. ej. a1, a2, b1...).
- Mezcla tipos distintos entre los tres textos para imitar un examen real.
- ${skill === "listening" ? "Usa cloze-max3 y opción múltiple A/B/C como en el examen de audio." : "Incluye heading-match y referent como en el examen de lectura."}`;
}

// ── AI grading of free-text items ─────────────────────────────────────────────
export type AiGradeItem = {
  id: string;
  type: BlockType | "justification";
  prompt: string;
  studentAnswer: string;
  expectedAnswer: string;
};

export function gradePromptFor(skill: "reading" | "listening"): string {
  const noun = skill === "listening" ? "comprensión auditiva" : "comprensión lectora";
  return `Eres un examinador del IB Spanish B corrigiendo respuestas de ${noun}.
Para cada ítem decide si la respuesta del alumno es correcta. Acepta equivalencia semántica y variaciones de redacción para respuestas abiertas; lo importante es que la idea/hecho clave coincida con la respuesta esperada. Para justificaciones, la cita debe respaldar la afirmación. Una respuesta vacía es incorrecta.

Devuelve SOLO JSON válido:
{ "results": [ { "id": "...", "correct": true, "feedback": "1 frase en español, específica" } ] }`;
}
