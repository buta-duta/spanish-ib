export type PracticeImage = {
  id: string;
  themeId: string;
  caption: string;
  description: string; // Rich context passed to AI examiner
  url: string;
};

const U = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&h=400`;

export const PRACTICE_IMAGES: PracticeImage[] = [
  // ── Identidades ────────────────────────────────────────────────────────────
  {
    id: "id-1",
    themeId: "identidades",
    caption: "Reunión familiar multigeneracional",
    description:
      "A large multigenerational Hispanic family gathered around a dining table for a celebration. Grandparents, parents, and young children are sharing food and conversation. Traditional decorations are visible. The scene evokes themes of family values, cultural transmission, and generational identity.",
    url: U("photo-1529156069898-49953e39b3ac"),
  },
  {
    id: "id-2",
    themeId: "identidades",
    caption: "Joven y redes sociales",
    description:
      "A teenager sitting alone in their room, surrounded by multiple screens showing social media feeds. Their expression is complex — engaged but somewhat isolated. The image raises questions about digital identity, self-presentation online, and the tension between virtual and real-world self.",
    url: U("photo-1611162616305-c69b3396fa0f"),
  },
  {
    id: "id-3",
    themeId: "identidades",
    caption: "Fiesta cultural tradicional",
    description:
      "A vibrant traditional Latin American festival with colourful costumes, music, and dancing in a public square. People of all ages are participating. The image evokes themes of cultural heritage, collective identity, and the preservation of traditions.",
    url: U("photo-1504711434969-e33886168f5c"),
  },
  {
    id: "id-4",
    themeId: "identidades",
    caption: "Personas migrantes en nuevo país",
    description:
      "A group of migrants arriving in a new city, carrying luggage and looking at an unfamiliar urban landscape. Their expressions mix hope and uncertainty. The image raises themes of displacement, bicultural identity, and the challenge of adapting to a new culture while preserving one's roots.",
    url: U("photo-1529156069898-49953e39b3ac"),
  },
  {
    id: "id-5",
    themeId: "identidades",
    caption: "Grupo multicultural de jóvenes",
    description:
      "A diverse group of young people from different cultural backgrounds laughing and socialising together in an urban setting. They wear a mix of traditional and modern clothing. The image explores multicultural identity, inclusion, and how young people navigate multiple cultural influences.",
    url: U("photo-1506057278442-6e9e0cb67f44"),
  },

  // ── Experiencias ───────────────────────────────────────────────────────────
  {
    id: "exp-1",
    themeId: "experiencias",
    caption: "Mochilero viajando por Latinoamérica",
    description:
      "A young backpacker standing at a scenic viewpoint in a mountainous Latin American region, looking out over a valley with a local village below. They carry a large rucksack. The image evokes themes of personal growth through travel, stepping out of one's comfort zone, and intercultural encounter.",
    url: U("photo-1488646953014-85cb44e25828"),
  },
  {
    id: "exp-2",
    themeId: "experiencias",
    caption: "Aprendiendo a cocinar comida tradicional",
    description:
      "An elderly woman teaching a young person how to prepare a traditional dish in a rustic kitchen. Spices, fresh ingredients, and handwritten recipe cards are visible. The scene evokes cultural transmission, the experience of learning family traditions, and intergenerational connection.",
    url: U("photo-1556910103-1c02745aae4d"),
  },
  {
    id: "exp-3",
    themeId: "experiencias",
    caption: "Actuación musical en vivo",
    description:
      "A musician performing on stage at an outdoor concert, with an engaged crowd in the background. The performer appears deeply connected to the music. The image raises themes of artistic expression as a transformative experience, the power of live performance, and cultural identity through music.",
    url: U("photo-1493225457124-a3eb161ffa5f"),
  },
  {
    id: "exp-4",
    themeId: "experiencias",
    caption: "Atleta en competición deportiva",
    description:
      "An athlete crossing a marathon finish line with exhaustion and triumph on their face. Other runners and supporters are visible in the background. The image evokes themes of determination, overcoming challenges, and how sporting experiences shape character and identity.",
    url: U("photo-1552674605-db6ffd4facb5"),
  },
  {
    id: "exp-5",
    themeId: "experiencias",
    caption: "Voluntarios ayudando en comunidad",
    description:
      "A group of young volunteers building a community structure or distributing food in a rural Latin American village. Local community members are participating alongside them. The image explores volunteer experiences, solidarity, and the personal impact of helping others.",
    url: U("photo-1559027615-cd4628902d4a"),
  },

  // ── Ingenio humano ─────────────────────────────────────────────────────────
  {
    id: "ing-1",
    themeId: "ingenio-humano",
    caption: "Científicos en laboratorio",
    description:
      "Two scientists in white lab coats working with advanced equipment in a modern research laboratory. Screens show complex data. The image raises questions about scientific innovation, research ethics, and the impact of new discoveries on society and medicine.",
    url: U("photo-1532187863486-abf9dbad1b69"),
  },
  {
    id: "ing-2",
    themeId: "ingenio-humano",
    caption: "Inteligencia artificial y robots",
    description:
      "A humanoid robot interacting with a human in what appears to be a care home or hospital setting. The robot's design is sophisticated and lifelike. The image provokes reflection on AI ethics, the future of work, and whether technology can replace human empathy.",
    url: U("photo-1485827404703-89b55fcc595e"),
  },
  {
    id: "ing-3",
    themeId: "ingenio-humano",
    caption: "Arquitectura urbana innovadora",
    description:
      "A stunning modern building with sustainable architecture features — vertical gardens, solar panels, and unusual geometric shapes — in a Latin American city. The image explores how human creativity transforms urban spaces, the intersection of art and engineering, and sustainable design.",
    url: U("photo-1486325212027-8081e485255e"),
  },
  {
    id: "ing-4",
    themeId: "ingenio-humano",
    caption: "Artista creando arte digital",
    description:
      "A digital artist working on a large touchscreen tablet, creating a vibrant and complex piece of digital art inspired by pre-Columbian imagery. The workspace blends traditional art tools with technology. The image evokes creativity, cultural heritage in the digital age, and the evolution of art.",
    url: U("photo-1626379953822-baec19c3accd"),
  },
  {
    id: "ing-5",
    themeId: "ingenio-humano",
    caption: "Tecnología médica avanzada",
    description:
      "Surgeons using robotic surgical equipment in an operating theatre, with high-definition screens showing real-time patient data. The image raises questions about the role of technology in healthcare, patient trust, access inequalities between wealthy and poorer nations, and medical ethics.",
    url: U("photo-1551190822-a9333d879b1f"),
  },

  // ── Organización social ────────────────────────────────────────────────────
  {
    id: "org-1",
    themeId: "organizacion-social",
    caption: "Manifestación por derechos sociales",
    description:
      "A large protest march in a Latin American capital city. Crowds hold banners demanding social rights — education, healthcare, and equality. Police are visible in the background. The image explores civic participation, the right to protest, and social inequality as a driver of political action.",
    url: U("photo-1591622249996-4f95c36cb7a6"),
  },
  {
    id: "org-2",
    themeId: "organizacion-social",
    caption: "Aula escolar en zona rural",
    description:
      "A classroom in a rural area where children sit at basic desks with limited materials. The teacher stands at a blackboard. The contrast between this setting and a modern city school is implied. The image raises issues of educational inequality, access to opportunity, and the state's role in education.",
    url: U("photo-1580582932707-520aed937b7b"),
  },
  {
    id: "org-3",
    themeId: "organizacion-social",
    caption: "Pobreza urbana en ciudad latinoamericana",
    description:
      "A neighbourhood of makeshift houses on the hillside of a Latin American city, with the gleaming modern city centre visible in the background. Children play in a narrow alley. The image starkly illustrates urban inequality, social stratification, and the challenges of housing and poverty.",
    url: U("photo-1516557070622-5f2925fe97e5"),
  },
  {
    id: "org-4",
    themeId: "organizacion-social",
    caption: "Proceso de votación democrática",
    description:
      "Citizens queuing to vote at a polling station, placing papers into ballot boxes. Election officials supervise. Some voters appear elderly, others young, showing civic participation across generations. The image explores democracy, political participation, and the challenges to fair elections.",
    url: U("photo-1477281765962-ef34e8bb0967"),
  },
  {
    id: "org-5",
    themeId: "organizacion-social",
    caption: "Hospital público con sala de espera llena",
    description:
      "An overcrowded hospital waiting room in a public healthcare facility. Patients of different ages wait on plastic chairs. Medical staff look exhausted. The image addresses healthcare access, public vs private health systems, underfunding of public services, and social justice.",
    url: U("photo-1519494026892-80bbd2d6fd0d"),
  },

  // ── Compartir el planeta ────────────────────────────────────────────────────
  {
    id: "pla-1",
    themeId: "compartir-el-planeta",
    caption: "Contaminación plástica en la costa",
    description:
      "A beach covered in plastic waste — bottles, bags, and packaging — with the ocean visible in the background. A lone figure walks through the debris. The image evokes plastic pollution, consumer culture, the impact of human activity on marine ecosystems, and individual vs corporate responsibility.",
    url: U("photo-1532996122724-e3c8de5b9a1a"),
  },
  {
    id: "pla-2",
    themeId: "compartir-el-planeta",
    caption: "Plantas de reciclaje y economía circular",
    description:
      "Workers sorting recyclable materials at a recycling facility. Coloured bins and conveyor belts are visible. A sign in Spanish promotes recycling. The image explores the circular economy, waste management infrastructure, and the gap between individual recycling habits and industrial-scale solutions.",
    url: U("photo-1542601906897-ecd6c5b0a1ee"),
  },
  {
    id: "pla-3",
    themeId: "compartir-el-planeta",
    caption: "Protesta por el cambio climático",
    description:
      "Young climate activists marching through a city street, holding signs in Spanish demanding urgent climate action. Their ages range from teenagers to adults. The image raises questions about intergenerational justice, political will, and whether individual actions can drive systemic change.",
    url: U("photo-1593113598332-cd288d649433"),
  },
  {
    id: "pla-4",
    themeId: "compartir-el-planeta",
    caption: "Conservación de fauna en peligro",
    description:
      "A conservation biologist in the field attaching a tracker to a wild animal — possibly a jaguar or condor — in a dense South American forest. The image evokes biodiversity, habitat loss, conservation science, and the ethical tension between human development and wildlife protection.",
    url: U("photo-1474511320723-9a56873867b5"),
  },
  {
    id: "pla-5",
    themeId: "compartir-el-planeta",
    caption: "Inundación causada por desastre natural",
    description:
      "An aerial view of a flooded town after extreme rainfall. Houses are partially submerged, and emergency boats carry stranded residents. The image discusses climate change as a driver of natural disasters, the vulnerability of poorer communities, and international humanitarian responsibility.",
    url: U("photo-1547683409-f3f0c96cb4cd"),
  },
];

export function getImagesForTheme(themeId: string): PracticeImage[] {
  return PRACTICE_IMAGES.filter((img) => img.themeId === themeId);
}
