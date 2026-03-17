export type ExaminerSection = {
  culturalUnderstanding: { description: string; examples: string[] };
  recommendedTenses: { tense: string; reason: string }[];
  connectives: string[];
  focusOfResponse: string[];
  commonMistakes: string[];
};

export type ExaminerGuide = {
  themeId: string;
  intro: string;
  sections: ExaminerSection;
};

export const EXAMINER_GUIDES: Record<string, ExaminerGuide> = {
  identidades: {
    themeId: "identidades",
    intro:
      "Examiners expect nuanced reflection on personal, cultural, and social identity. Students should demonstrate awareness of how context shapes who we are.",
    sections: {
      culturalUnderstanding: {
        description:
          "Reference specific cultural practices, family structures, and generational differences. Distinguish between Spanish and Latin American identities where relevant.",
        examples: [
          "La quinceañera como rito de paso en México y otros países latinoamericanos",
          "El papel del apellido materno en la identidad hispana",
          "La influencia de la Reconquista en la identidad española moderna",
          "La identidad mestiza y su importancia en México y Perú",
          "Los movimientos feministas actuales en Argentina y España",
        ],
      },
      recommendedTenses: [
        { tense: "Present indicative", reason: "Describing current identity, beliefs, values" },
        { tense: "Imperfect", reason: "Describing how identity was shaped in the past" },
        { tense: "Conditional", reason: "Reflecting on what you would do differently" },
        { tense: "Subjunctive (present)", reason: "Expressing doubt, wishes about identity" },
        { tense: "Reflexive verbs + pronominals", reason: "Self-reflection: 'me considero', 'me identifico'" },
      ],
      connectives: [
        "En cuanto a… (As for…)",
        "Desde mi punto de vista… (From my point of view…)",
        "Sin embargo… (However…)",
        "Por un lado… por otro lado… (On one hand… on the other…)",
        "Cabe destacar que… (It is worth noting that…)",
        "Esto se debe a… (This is due to…)",
        "A pesar de… (Despite…)",
        "En definitiva… (Ultimately…)",
      ],
      focusOfResponse: [
        "Balance personal experience with wider cultural/social analysis",
        "Show depth: move from description → interpretation → evaluation",
        "Link individual identity to collective or national identity",
        "Demonstrate awareness of how identity can be fluid or contested",
        "Avoid stating opinions without justification — always explain *why*",
      ],
      commonMistakes: [
        "Listing facts about culture without analysing their significance",
        "Using only present tense — vary tenses to show linguistic range",
        "Staying surface-level ('Mi familia es importante') — go deeper",
        "Ignoring Latin American perspectives — IB expects global Hispanic awareness",
        "Confusing 'ser' and 'estar' in identity descriptions",
      ],
    },
  },

  experiencias: {
    themeId: "experiencias",
    intro:
      "Examiners want students to move beyond narrating events and instead reflect on how experiences changed them. Personal growth, intercultural encounters, and transformation are key.",
    sections: {
      culturalUnderstanding: {
        description:
          "Link experiences to cultural practices. Reference how travel, education, or volunteering opens intercultural understanding in Spanish-speaking contexts.",
        examples: [
          "El Camino de Santiago como experiencia espiritual y personal en España",
          "Los programas de voluntariado en Bolivia o Ecuador",
          "El intercambio estudiantil entre países hispanohablantes",
          "La experiencia de emigrar desde Venezuela o Colombia a otro país",
          "Las fiestas patronales locales como experiencias comunitarias únicas",
        ],
      },
      recommendedTenses: [
        { tense: "Preterite (indefinido)", reason: "Narrating completed past events clearly" },
        { tense: "Imperfect (imperfecto)", reason: "Describing ongoing background or how things used to be" },
        { tense: "Present perfect", reason: "Linking past experience to present impact" },
        { tense: "Conditional perfect", reason: "Reflecting: 'Habría aprendido más si…'" },
        { tense: "Subjunctive (imperfect)", reason: "Hypothetical reflection: 'Si hubiera sabido…'" },
      ],
      connectives: [
        "Al principio… (At first…)",
        "Poco a poco… (Little by little…)",
        "Como resultado… (As a result…)",
        "Lo que más me impactó fue… (What impacted me most was…)",
        "Gracias a esta experiencia… (Thanks to this experience…)",
        "No sólo… sino también… (Not only… but also…)",
        "Por consiguiente… (Consequently…)",
        "En retrospectiva… (In retrospect…)",
      ],
      focusOfResponse: [
        "Don't just describe — evaluate: what did you learn, how did it change you?",
        "Use specific anecdotes, not vague generalisations",
        "Show intercultural awareness: how did encountering another culture affect you?",
        "Connect personal experience to broader societal themes",
        "Demonstrate emotional intelligence alongside language accuracy",
      ],
      commonMistakes: [
        "Telling a story chronologically without any reflection",
        "Using only preterite — no contrast with imperfect",
        "Saying 'fue una experiencia muy buena/mala' without elaboration",
        "Missing opportunities to use perfect/conditional/subjunctive for depth",
        "Forgetting to link the experience to a wider social or cultural point",
      ],
    },
  },

  "ingenio-humano": {
    themeId: "ingenio-humano",
    intro:
      "Examiners expect critical analysis of technology and human creativity — not just description of what exists, but evaluation of its impact on society, culture, and ethics.",
    sections: {
      culturalUnderstanding: {
        description:
          "Reference tech innovation in Latin America and Spain. Also discuss art, music, and literature as forms of human ingenuity.",
        examples: [
          "El emprendimiento tecnológico en Silicon Valley hispanohablante (Miami, Ciudad de México)",
          "La brecha digital entre zonas rurales y urbanas en América Latina",
          "Los muralistas mexicanos (Rivera, Orozco) como expresión de identidad cultural",
          "El impacto de las redes sociales en la política latinoamericana",
          "La innovación en energías renovables en Chile y Uruguay",
        ],
      },
      recommendedTenses: [
        { tense: "Present indicative", reason: "Describing current technologies and trends" },
        { tense: "Future (simple)", reason: "Predicting societal impact: 'La IA transformará…'" },
        { tense: "Conditional", reason: "Discussing what could/should be done" },
        { tense: "Subjunctive (present)", reason: "Expressing concern, hope, necessity: 'Es importante que…'" },
        { tense: "Past (preterite + imperfect)", reason: "Contrasting past vs present innovation" },
      ],
      connectives: [
        "Por un lado… (On one hand…)",
        "No obstante… (Nevertheless…)",
        "Hay que tener en cuenta que… (One must consider that…)",
        "Ello plantea la cuestión de… (This raises the question of…)",
        "En términos de impacto social… (In terms of social impact…)",
        "Cabe preguntarse si… (One might ask whether…)",
        "A largo plazo… (In the long term…)",
        "Desde una perspectiva ética… (From an ethical perspective…)",
      ],
      focusOfResponse: [
        "Analyse benefits AND risks — avoid one-sided answers",
        "Link technology to its human creators and their cultural context",
        "Discuss ethics: privacy, job displacement, digital divide",
        "Broaden to art and creativity — ingenuity is not only technology",
        "Support arguments with concrete examples from Hispanic contexts",
      ],
      commonMistakes: [
        "Describing technology without evaluating its social or cultural impact",
        "Forgetting to mention Latin American innovation — not just US/EU examples",
        "Using simplistic vocabulary: 'la tecnología es buena/mala'",
        "Missing subjunctive when expressing opinions and concerns",
        "Ignoring ethical dimensions — examiners reward nuanced judgement",
      ],
    },
  },

  "organizacion-social": {
    themeId: "organizacion-social",
    intro:
      "Examiners look for understanding of social systems, inequalities, and civic responsibility. Students should engage critically with real social issues, not just describe institutions.",
    sections: {
      culturalUnderstanding: {
        description:
          "Reference real social challenges in Latin America and Spain: inequality, political systems, education access, and health systems.",
        examples: [
          "La desigualdad educativa entre zonas rurales y urbanas en México",
          "El sistema de salud pública en Cuba vs sistemas privados latinoamericanos",
          "Los movimientos sociales en Chile (2019) y Colombia (2021)",
          "La corrupción política y su impacto en la confianza ciudadana",
          "Los derechos de los pueblos indígenas en Ecuador y Bolivia",
        ],
      },
      recommendedTenses: [
        { tense: "Present indicative", reason: "Describing current social structures and problems" },
        { tense: "Subjunctive (present)", reason: "Recommending change: 'Es necesario que el gobierno…'" },
        { tense: "Conditional", reason: "Proposing solutions: 'Se debería invertir en…'" },
        { tense: "Preterite", reason: "Referring to specific past social events or policies" },
        { tense: "Impersonal constructions", reason: "'Se debe', 'es fundamental que', 'hay que'" },
      ],
      connectives: [
        "Sin embargo… (However…)",
        "A pesar de los avances… (Despite the advances…)",
        "Es imprescindible que… (It is essential that…)",
        "Desde una perspectiva sociológica… (From a sociological perspective…)",
        "Por lo tanto… (Therefore…)",
        "Tanto… como… (Both… and…)",
        "En comparación con… (Compared to…)",
        "Se podría argumentar que… (One could argue that…)",
      ],
      focusOfResponse: [
        "Move beyond description of systems — evaluate their effectiveness and fairness",
        "Show awareness of inequality: class, gender, ethnicity, geography",
        "Propose concrete, reasoned solutions — not just vague improvements",
        "Compare Spanish-speaking countries with each other or with global norms",
        "Demonstrate civic engagement: why does this matter for individuals?",
      ],
      commonMistakes: [
        "Describing institutions without critically evaluating them",
        "Giving opinions without using subjunctive or conditional structures",
        "Ignoring gender, racial, or economic dimensions of social issues",
        "Staying abstract — use real examples from Latin America or Spain",
        "Using only present tense — show range with subjunctive and conditional",
      ],
    },
  },

  "compartir-el-planeta": {
    themeId: "compartir-el-planeta",
    intro:
      "Examiners expect students to analyse environmental issues at local, national, and global levels. Scientific understanding combined with societal and personal responsibility is essential.",
    sections: {
      culturalUnderstanding: {
        description:
          "Reference specific environmental challenges in Latin America and Spain: deforestation in the Amazon, water scarcity, renewable energy projects.",
        examples: [
          "La deforestación de la Amazonía en Brasil y sus consecuencias globales",
          "La escasez de agua en el norte de México y el altiplano boliviano",
          "Chile y Costa Rica como líderes en energías renovables en Latinoamérica",
          "Los incendios forestales en la Patagonia argentina y española",
          "Los acuerdos ambientales de COP y su impacto en América Latina",
        ],
      },
      recommendedTenses: [
        { tense: "Present indicative", reason: "Stating current environmental facts and data" },
        { tense: "Future simple", reason: "Predicting consequences: 'El nivel del mar subirá…'" },
        { tense: "Conditional", reason: "Suggesting solutions: 'Se reduciría la contaminación si…'" },
        { tense: "Subjunctive (present)", reason: "Expressing urgency: 'Es urgente que cambiemos…'" },
        { tense: "Conditional perfect", reason: "Hypothetical past: 'Si hubiéramos actuado antes…'" },
      ],
      connectives: [
        "Debido a… (Due to…)",
        "Como consecuencia de… (As a consequence of…)",
        "A menos que… (Unless…)",
        "Para que esto cambie… (For this to change…)",
        "Es fundamental que… (It is fundamental that…)",
        "Más allá de… (Beyond…)",
        "A escala mundial… (On a global scale…)",
        "En colaboración con… (In collaboration with…)",
      ],
      focusOfResponse: [
        "Link local environmental issues to global consequences",
        "Show both individual AND collective/governmental responsibility",
        "Evaluate the effectiveness of current solutions — don't just list them",
        "Use data and specific examples to support arguments",
        "Demonstrate awareness of environmental justice: who suffers most?",
      ],
      commonMistakes: [
        "Listing environmental problems without analysing causes or solutions",
        "Ignoring Latin American-specific environmental contexts",
        "Failing to use subjunctive for recommendations and concerns",
        "Saying 'debemos cuidar el planeta' without specifics",
        "Focusing only on individual actions without discussing systemic change",
      ],
    },
  },
};
