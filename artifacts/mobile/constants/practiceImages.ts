export type PracticeImage = {
  id: string;
  themeId: string;
  caption: string;
  description: string;
  url: string;
  fallbackUrl: string;
};

const U = (id: string, w = 600, h = 400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const P = (id: number, w = 600, h = 400) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

export const PRACTICE_IMAGES: PracticeImage[] = [
  // ── Identidades ────────────────────────────────────────────────────────────
  {
    id: "id-1",
    themeId: "identidades",
    caption: "Reunión familiar multigeneracional",
    description:
      "A large multigenerational Hispanic family gathered around a dining table for a celebration. Grandparents, parents, and young children are sharing food and conversation. Traditional decorations are visible. The scene evokes themes of family values, cultural transmission, and generational identity.",
    url: U("photo-1511895426328-dc8714191011"),
    fallbackUrl: P(3184418),
  },
  {
    id: "id-2",
    themeId: "identidades",
    caption: "Joven y redes sociales",
    description:
      "A teenager sitting on a bed surrounded by multiple glowing screens showing social media feeds, notifications, and messages. Their expression is complex — engaged but somewhat isolated. The image raises questions about digital identity, self-presentation online, and the tension between virtual and real-world relationships.",
    url: U("photo-1596558450255-7c0d7feb4a29"),
    fallbackUrl: P(4144923),
  },
  {
    id: "id-3",
    themeId: "identidades",
    caption: "Fiesta cultural tradicional",
    description:
      "A vibrant traditional Latin American festival with colourful costumes, music, and dancing in a busy public square. People of all ages are participating — children in traditional dress, elderly couples dancing, young adults playing instruments. The image evokes themes of cultural heritage, collective identity, and the preservation of traditions.",
    url: U("photo-1504711434969-e33886168f5c"),
    fallbackUrl: P(2263436),
  },
  {
    id: "id-4",
    themeId: "identidades",
    caption: "Personas migrantes en nuevo país",
    description:
      "A group of migrants arriving at a busy urban train station, carrying luggage and looking at an unfamiliar city landscape. Families with children, young adults, and elderly people stand together looking at maps and signs in an unfamiliar language. Their expressions mix hope and uncertainty. The image raises themes of displacement, bicultural identity, and adapting to a new culture while preserving roots.",
    url: U("photo-1570751259070-20e6ef670e72"),
    fallbackUrl: P(3729784),
  },
  {
    id: "id-5",
    themeId: "identidades",
    caption: "Grupo multicultural de jóvenes",
    description:
      "A diverse group of six young people from different cultural backgrounds laughing and socialising together on a city rooftop. They wear a mix of traditional and modern clothing. Some are taking photos, others are talking intensely. The image explores multicultural identity, friendship across cultures, and how young people navigate multiple cultural influences.",
    url: U("photo-1529156069898-49953e39b3ac"),
    fallbackUrl: P(1181396),
  },

  // ── Experiencias ───────────────────────────────────────────────────────────
  {
    id: "exp-1",
    themeId: "experiencias",
    caption: "Mochilero viajando por Latinoamérica",
    description:
      "A young backpacker standing at a scenic viewpoint overlooking a valley in the Andes, pointing into the distance while talking to a local guide. They carry a large rucksack covered in patches from different countries. A local village is visible below. The image evokes themes of personal growth through travel, cultural exchange, and stepping out of one's comfort zone.",
    url: U("photo-1476514525535-07fb3b4ae5f1"),
    fallbackUrl: P(1181474),
  },
  {
    id: "exp-2",
    themeId: "experiencias",
    caption: "Aprendiendo a cocinar comida tradicional",
    description:
      "An elderly woman teaching a young person how to prepare a traditional tamale dish in a rustic kitchen. Spices, fresh corn husks, and handwritten recipe cards are spread across the table. The grandmother guides the young person's hands. The scene evokes cultural transmission, learning family traditions, and the experience of intergenerational connection.",
    url: U("photo-1556910103-1c02745aae4d"),
    fallbackUrl: P(2097090),
  },
  {
    id: "exp-3",
    themeId: "experiencias",
    caption: "Actuación musical en vivo",
    description:
      "A musician performing passionately on stage at an outdoor Latin music concert, with thousands of engaged fans in the background waving flags and singing along. Stage lights illuminate the performer. The image raises themes of artistic expression as a transformative experience, the power of live music, and how shared cultural events create collective identity.",
    url: U("photo-1493225457124-a3eb161ffa5f"),
    fallbackUrl: P(1190297),
  },
  {
    id: "exp-4",
    themeId: "experiencias",
    caption: "Atleta cruzando la meta del maratón",
    description:
      "An exhausted but triumphant athlete crossing a marathon finish line, arms raised, with tears of joy. Supporters cheer from behind barriers and other runners are visible behind. A clock shows the finishing time. The image evokes themes of determination, overcoming personal challenges, the physical and mental limits of human endurance, and how sporting experiences shape identity.",
    url: U("photo-1552674605-db6ffd4facb5"),
    fallbackUrl: P(2312369),
  },
  {
    id: "exp-5",
    themeId: "experiencias",
    caption: "Voluntarios construyendo casas en comunidad",
    description:
      "A team of international volunteers working alongside local community members to build concrete block houses in a rural Latin American village. Young people mix cement, carry materials, and interact with local families. Children watch curiously. The image explores volunteer experiences, international solidarity, and the personal impact of helping others across cultural boundaries.",
    url: U("photo-1559027615-cd4628902d4a"),
    fallbackUrl: P(6646917),
  },

  // ── Ingenio humano ─────────────────────────────────────────────────────────
  {
    id: "ing-1",
    themeId: "ingenio-humano",
    caption: "Científicos investigando en laboratorio",
    description:
      "Two scientists — a woman and a man — in white lab coats examining samples under a microscope in a modern research laboratory. Screens show complex molecular data and graphs. Lab equipment fills the background. The image raises questions about scientific innovation, research ethics, and the impact of new discoveries on medicine and global health.",
    url: U("photo-1532187863486-abf9dbad1b69"),
    fallbackUrl: P(3912981),
  },
  {
    id: "ing-2",
    themeId: "ingenio-humano",
    caption: "Jóvenes desarrollando inteligencia artificial",
    description:
      "A diverse team of young programmers and engineers in a tech lab collaborating around large monitors displaying AI code, neural network diagrams, and data visualisations. Post-it notes cover a wall behind them. They appear animated and engaged. The image provokes reflection on AI ethics, youth innovation, the future of employment, and whether technology can solve social problems.",
    url: U("photo-1531482615713-2afd69097998"),
    fallbackUrl: P(3861969),
  },
  {
    id: "ing-3",
    themeId: "ingenio-humano",
    caption: "Arquitectura urbana innovadora y sostenible",
    description:
      "A stunning modern building with sustainable architecture features — vertical gardens climbing the facade, solar panels on the roof, and unusual geometric shapes — set in a Latin American city with traditional buildings nearby. People walk and cycle in front of it. The image explores how human creativity transforms urban spaces, the intersection of art and engineering, and sustainable design principles.",
    url: U("photo-1486325212027-8081e485255e"),
    fallbackUrl: P(2078343),
  },
  {
    id: "ing-4",
    themeId: "ingenio-humano",
    caption: "Artista creando arte digital",
    description:
      "A digital artist working intently on a large touchscreen tablet in a modern studio, creating a vibrant piece of digital art inspired by pre-Columbian imagery. Traditional brushes and art books are also visible on the desk, alongside a cutting-edge tablet. The workspace blends traditional art heritage with modern technology — exploring how creativity, cultural identity, and innovation intersect.",
    url: U("photo-1626379953822-baec19c3accd"),
    fallbackUrl: P(196644),
  },
  {
    id: "ing-5",
    themeId: "ingenio-humano",
    caption: "Tecnología médica avanzada en cirugía",
    description:
      "Surgeons using robotic surgical equipment in an operating theatre, with high-definition screens showing real-time patient data and a magnified surgical field. The surgical team of three doctors and two nurses works with intense focus. The image raises questions about the role of technology in healthcare, patient trust, the growing divide in medical access between wealthy and poorer nations, and medical ethics.",
    url: U("photo-1551190822-a9333d879b1f"),
    fallbackUrl: P(3786157),
  },

  // ── Organización social ────────────────────────────────────────────────────
  {
    id: "org-1",
    themeId: "organizacion-social",
    caption: "Manifestación por derechos sociales",
    description:
      "A large protest march through a Latin American capital city. Thousands of marchers hold banners demanding social rights — universal education, healthcare, and gender equality. Police in riot gear are visible in the background. Students, workers, and families march together. The image explores civic participation, the right to protest, social inequality as a driver of political action, and state responses to dissent.",
    url: U("photo-1591622249996-4f95c36cb7a6"),
    fallbackUrl: P(1464226),
  },
  {
    id: "org-2",
    themeId: "organizacion-social",
    caption: "Aula escolar en zona rural",
    description:
      "A classroom in a rural area where twenty children sit at worn wooden desks with limited textbooks. A dedicated teacher writes on a cracked blackboard. Through the window, farmland is visible. The contrast between this setting and a modern city school is striking. The image raises issues of educational inequality, access to opportunity, and the state's responsibility to provide quality public education for all.",
    url: U("photo-1580582932707-520aed937b7b"),
    fallbackUrl: P(5212345),
  },
  {
    id: "org-3",
    themeId: "organizacion-social",
    caption: "Desigualdad urbana: favela y ciudad moderna",
    description:
      "An aerial photograph showing a dense hillside neighbourhood of makeshift houses in sharp contrast with the gleaming glass towers of the modern city centre visible just beyond. Children play in a narrow alley between colourful but crumbling buildings. A family watches the city from their doorway. The image starkly illustrates urban inequality, social stratification, housing insecurity, and the paradox of development.",
    url: U("photo-1516557070622-5f2925fe97e5"),
    fallbackUrl: P(2868665),
  },
  {
    id: "org-4",
    themeId: "organizacion-social",
    caption: "Ciudadanos votando en elecciones",
    description:
      "A long queue of citizens of all ages waiting to vote at a polling station, placing folded papers into ballot boxes. Election officials supervise carefully. Some voters are elderly and assisted by family members; others are young first-time voters. The image explores democracy, civic participation, intergenerational political engagement, and the challenges to fair and accessible elections.",
    url: U("photo-1477281765962-ef34e8bb0967"),
    fallbackUrl: P(2068975),
  },
  {
    id: "org-5",
    themeId: "organizacion-social",
    caption: "Sala de espera hospital público",
    description:
      "An overcrowded hospital waiting room in a public healthcare facility. Patients of different ages — young children, working adults, elderly — wait on plastic chairs, some for hours. Exhausted medical staff move through the crowd. A sign shows a waiting time of 4 hours. The image addresses healthcare access, the contrast between public and private health systems, chronic underfunding, and the social justice dimension of health inequalities.",
    url: U("photo-1519494026892-80bbd2d6fd0d"),
    fallbackUrl: P(236380),
  },

  // ── Compartir el planeta ────────────────────────────────────────────────────
  {
    id: "pla-1",
    themeId: "compartir-el-planeta",
    caption: "Contaminación plástica en la costa",
    description:
      "A beach overwhelmed by plastic waste — bottles, bags, packaging, and fishing nets — washed up across the sand and into the water. Volunteers in coloured vests collect rubbish in large sacks. Local fishing boats sit in the background. A child holds up a plastic bottle with a look of confusion and concern. The image evokes plastic pollution, consumer culture, corporate responsibility, and the gap between awareness and action.",
    url: U("photo-1618477388954-7852f32655ec"),
    fallbackUrl: P(802489),
  },
  {
    id: "pla-2",
    themeId: "compartir-el-planeta",
    caption: "Trabajadores en planta de reciclaje",
    description:
      "Workers in high-visibility vests sorting recyclable materials at a busy recycling facility. Coloured bins, conveyor belts, and large bales of compressed plastic and cardboard fill the space. A sign in Spanish promotes the circular economy. The image explores waste management infrastructure, the circular economy concept, and the tension between individual recycling habits and the need for industrial-scale solutions.",
    url: U("photo-1611284446314-60a58ac0debb"),
    fallbackUrl: P(3826435),
  },
  {
    id: "pla-3",
    themeId: "compartir-el-planeta",
    caption: "Protesta juvenil por el cambio climático",
    description:
      "Young climate activists — predominantly teenagers and university students — marching through a city centre, holding handmade signs in Spanish demanding urgent climate action: 'El planeta no tiene planeta B' and 'Actúa ahora'. Their ages range from pre-teens to young adults. Some wear costumes representing extinct animals. The image raises questions about intergenerational justice, political will, the role of youth in climate policy, and whether individual actions can drive systemic change.",
    url: U("photo-1573126617899-41f1dffb196c"),
    fallbackUrl: P(9754289),
  },
  {
    id: "pla-4",
    themeId: "compartir-el-planeta",
    caption: "Biólogos conservando fauna silvestre",
    description:
      "A team of three conservation biologists in the field, attaching a radio tracking collar to a sedated jaguar in a dense South American rainforest. GPS equipment and field notebooks are visible. The scientists work carefully and respectfully. The image evokes biodiversity loss, habitat destruction, conservation science, and the ethical tension between human development needs and wildlife protection.",
    url: U("photo-1518020382113-a7e8fc38eac9"),
    fallbackUrl: P(567840),
  },
  {
    id: "pla-5",
    themeId: "compartir-el-planeta",
    caption: "Inundación por desastre climático",
    description:
      "An aerial view of a partially flooded town after extreme rainfall linked to climate change. Houses are partially submerged and streets have become rivers. Emergency rescue boats carry stranded residents — elderly people, families with babies, people clutching belongings. Helicopters circle overhead. The image powerfully illustrates climate change as a driver of natural disasters, the vulnerability of poorer communities to extreme weather, and the moral question of international humanitarian responsibility.",
    url: U("photo-1604977042946-1eecc30f269e"),
    fallbackUrl: P(1098279),
  },
];

export function getImagesForTheme(themeId: string): PracticeImage[] {
  return PRACTICE_IMAGES.filter((img) => img.themeId === themeId);
}
