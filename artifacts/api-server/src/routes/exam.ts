import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

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
5. After 6-8 exchanges, you may occasionally link to a second IB theme to train cross-theme thinking (Band 6-7 skill). For example: "¿Cómo se relaciona este tema con la tecnología moderna?"
6. Keep your responses concise: feedback (1-2 sentences) + question (1 sentence).
7. Start with an accessible warm-up question, then gradually increase difficulty.
8. Use formal "usted" or informal "tú" consistently (prefer "tú" for student interactions).
9. Show authentic examiner personality: be professional but encouraging.
10. Reference the theme in your questions naturally.

Begin the exam by welcoming the student warmly in Spanish and asking your first question about the theme.
`;

router.post("/exam/chat", async (req, res) => {
  const { messages, theme, sessionTurn } = req.body;

  if (!theme || !messages) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const themeKey = theme.toLowerCase().replace(/\s+/g, "-");
  const themePrompt = THEME_DESCRIPTIONS[themeKey] || THEME_DESCRIPTIONS["identidades"];

  const systemPrompt = themePrompt + BASE_INSTRUCTIONS;

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

export default router;
