// Phase 2 of the expedition (EN + FR): "Catch and release" (net and jar), "Measure it" (tape and scale),
// "A real dig" (trowel and brush) and "The Bug Games". The insects' Field Guide pages carry real facts and
// real sizes, each with the source it can be checked in. These are props defaults (the saved variant holds
// the same content, with the voice-over URLs).
import type { ExpeditionUi, GuideFact, GuideSpecies, KeeperLine, Dialogue, LensFeature, Quest, Tool } from "../block";
import { P2_ASSETS } from "./assets.gen";

const L = (en: string, fr: string) => ({ en, fr });
const F = (en: string, fr: string, easyEn: string, easyFr: string, source: string): GuideFact => ({ text: L(en, fr), easy: L(easyEn, easyFr), source });
const A = (k: string) => P2_ASSETS[k] || "";

/** seen · photographed · identified (in the jar) · caught and released · measured */
export const INSECT_STAGES = [1, 2, 4, 16, 32];

export const phase2Quests: Quest[] = [
  {
    id: "catch-release",
    icon: "🦗",
    title: L("Catch and release", "Attraper et relâcher"),
    intro: "catch",
    done: "catchDone",
    giveAtStart: ["net", "jar"],
    reward: [],
    steps: [
      { id: "release-two", kind: "release", target: "any", count: 2, zone: "", icon: "🫙", text: L("Catch, look at and release 2 different creatures {n}/{count}", "Attrape, observe et relâche 2 créatures différentes {n}/{count}"), line: "catchStep" },
    ],
  },
  {
    id: "measure-it",
    icon: "📏",
    title: L("Measure it", "Mesure-la"),
    intro: "measure",
    done: "measureDone",
    giveAtStart: ["tape", "scale"],
    reward: [],
    steps: [
      { id: "measure-two", kind: "measure", target: "any", count: 2, zone: "", icon: "📏", text: L("Measure 2 different creatures with the tape {n}/{count}", "Mesure 2 créatures différentes avec le mètre {n}/{count}"), line: "measureStep" },
      { id: "weigh-one", kind: "weigh", target: "any", count: 1, zone: "", icon: "⚖️", text: L("Weigh a creature on the scale", "Pèse une créature sur la balance"), line: "weighStep" },
    ],
  },
  {
    id: "real-dig",
    icon: "⛏️",
    title: L("A real dig", "Une vraie fouille"),
    intro: "dig",
    done: "digDone",
    giveAtStart: ["trowel", "brush"],
    reward: [],
    steps: [
      { id: "dig-block", kind: "dig", target: "fossils", count: 1, zone: "biome-frontier", icon: "⛏️", text: L("Dig up the 5 fossils in the Biome Frontier canyon", "Déterre les 5 fossiles dans le canyon de la Frontière des biomes"), line: "digStep" },
    ],
  },
  {
    id: "bug-games",
    icon: "🏅",
    title: L("The Bug Games", "Les Jeux des insectes"),
    intro: "games",
    done: "allDone2",
    giveAtStart: [],
    reward: [],
    report: true,
    steps: [
      { id: "games-round", kind: "games", target: "any", count: 1, zone: "idea-grove", icon: "🏅", text: L("Play a round of the Bug Games (west of the Idea Tree)", "Joue une manche des Jeux des insectes (à l'ouest de l'Arbre à idées)"), line: "gamesStep" },
    ],
  },
];

export const phase2Lines: KeeperLine[] = [
  { id: "catch1", anim: "wave", text: L("Now let's meet the insects! Here are a net and a jar.", "Partons à la rencontre des insectes ! Voici un filet et un bocal.") },
  { id: "catch2", anim: "point", text: L("Sweep the net gently, look at your catch in the jar, then let it go right where you found it.", "Balaie doucement avec le filet, observe ta prise dans le bocal, puis relâche-la là où tu l'as trouvée.") },
  { id: "catchStep", anim: "talk", text: L("Catch two different creatures, look at them closely, and let them go where you found them.", "Attrape deux créatures différentes, observe-les de près, et relâche-les là où tu les as trouvées.") },
  { id: "catchDone", anim: "wave", text: L("Well done! A good explorer always lets creatures go home.", "Bravo ! Un bon explorateur laisse toujours les créatures rentrer chez elles.") },
  { id: "measure1", anim: "talk", text: L("Scientists measure things. Here are a tape measure and a scale.", "Les scientifiques mesurent les choses. Voici un mètre ruban et une balance.") },
  { id: "measureStep", anim: "talk", text: L("Catch a creature, then measure it with the tape, head to tail. Measure two different ones.", "Attrape une créature, puis mesure-la avec le mètre, de la tête à la queue. Mesures-en deux différentes.") },
  { id: "weighStep", anim: "talk", text: L("Now weigh a creature: put weights on the scale until it is level.", "Maintenant, pèse une créature : mets des poids sur la balance jusqu'à ce qu'elle soit droite.") },
  { id: "measureDone", anim: "wave", text: L("Real numbers! Compare the sizes in your Field Guide.", "De vrais nombres ! Compare les tailles dans ton Guide de terrain.") },
  { id: "dig1", anim: "point", text: L("In the Biome Frontier canyon, there is a dig. Take this trowel and this soft brush.", "Dans le canyon de la Frontière des biomes, il y a une fouille. Prends cette truelle et cette brosse douce.") },
  { id: "digStep", anim: "talk", text: L("Dig away the layers with the trowel, then brush each fossil clean.", "Retire les couches avec la truelle, puis nettoie chaque fossile avec la brosse.") },
  { id: "digDone", anim: "wave", text: L("The deeper you dug, the older the fossils. You read the timeline of the Earth!", "Plus tu creusais, plus les fossiles étaient anciens. Tu as lu la frise du temps de la Terre !") },
  { id: "games1", anim: "wave", text: L("The Bug Games are on! The arena is in the meadow, west of the Idea Tree.", "Les Jeux des insectes commencent ! L'arène est dans la prairie, à l'ouest de l'Arbre à idées.") },
  { id: "gamesStep", anim: "point", text: L("Pick the right athlete for each event, and the right time of day.", "Choisis le bon athlète pour chaque épreuve, et le bon moment de la journée.") },
  { id: "allDone2", anim: "wave", text: L("What a champion team! Keep exploring and keep filling your Field Guide.", "Quelle équipe de champions ! Continue d'explorer et de remplir ton Guide de terrain.") },
];

export const phase2Dialogues: Dialogue[] = [
  { id: "catch", lines: ["catch1", "catch2"] },
  { id: "catchDone", lines: ["catchDone"] },
  { id: "measure", lines: ["measure1", "measureStep"] },
  { id: "measureDone", lines: ["measureDone"] },
  { id: "dig", lines: ["dig1", "digStep"] },
  { id: "digDone", lines: ["digDone"] },
  { id: "games", lines: ["games1", "gamesStep"] },
  { id: "allDone2", lines: ["allDone2"] },
];

export const phase2Tools: Tool[] = [
  { id: "net", icon: "🥅", iconUrl: A("tool:net:icon"), modelUrl: A("tool:net"), name: L("Butterfly net", "Filet à papillons"), about: L("Sweep it gently over an insect to catch it without hurting it.", "Balaie-le doucement au-dessus d'un insecte pour l'attraper sans lui faire mal.") },
  { id: "jar", icon: "🫙", iconUrl: A("tool:jar:icon"), modelUrl: A("tool:jar"), name: L("Bug jar", "Bocal à insectes"), about: L("A jar with air holes, to look at a creature for a moment before letting it go.", "Un bocal percé de trous d'air, pour observer une créature un moment avant de la relâcher.") },
  { id: "tape", icon: "📏", iconUrl: A("tool:tape:icon"), modelUrl: A("tool:tape"), name: L("Tape measure", "Mètre ruban"), about: L("Pull the tape from the tail to the head to measure a creature's real length.", "Tire le ruban de la queue à la tête pour mesurer la vraie longueur d'une créature.") },
  { id: "scale", icon: "⚖️", iconUrl: A("tool:scale:icon"), modelUrl: A("tool:scale"), name: L("Pan balance", "Balance à plateaux"), about: L("Add weights until the beam is level: then both pans weigh the same.", "Ajoute des poids jusqu'à ce que le fléau soit droit : les deux plateaux pèsent alors pareil.") },
  { id: "trowel", icon: "🔨", iconUrl: A("tool:trowel:icon"), modelUrl: A("tool:trowel"), name: L("Trowel", "Truelle"), about: L("Scrape away one layer of soil or rock at a time.", "Gratte une couche de terre ou de roche à la fois.") },
  { id: "brush", icon: "🖌️", iconUrl: A("tool:brush:icon"), modelUrl: A("tool:brush"), name: L("Soft brush", "Brosse douce"), about: L("Brush the dust off a fossil gently, so it does not break.", "Enlève doucement la poussière d'un fossile, pour qu'il ne se casse pas.") },
];

export const phase2LensFeatures: LensFeature[] = [
  { id: "bodyParts", kind: "count", icon: "🧩", max: 5, question: L("How many body parts (sections)?", "Combien de parties du corps ?"), tip: L("Look for the head, then the middle part where the legs are, then the back part.", "Cherche la tête, puis la partie du milieu où sont les pattes, puis la partie arrière.") },
  { id: "trueLegs", kind: "count", icon: "🦵", max: 20, question: L("How many pointy true legs near its head?", "Combien de vraies pattes pointues près de sa tête ?"), tip: L("Only count the pointy legs near the head. The soft stubby ones further back are not true legs.", "Compte seulement les pattes pointues près de la tête. Les petites pattes molles plus loin ne sont pas de vraies pattes.") },
];

const insectId = (en: string, fr: string) => F(en, fr, "It is an insect: 6 legs, 3 body parts.", "C'est un insecte : 6 pattes, 3 parties du corps.", "Encyclopaedia Britannica, “Insect”");

function sp(o: Omit<GuideSpecies, "iconUrl" | "silhouetteUrl" | "modelUrl" | "scale" | "stages"> & { key: string; scale?: number; stages?: number[] }): GuideSpecies {
  const { key, ...rest } = o;
  return {
    ...rest,
    iconUrl: A("insect:" + key + ":icon"),
    silhouetteUrl: A("insect:" + key + ":silhouette"),
    modelUrl: A("insect:" + key),
    camoModelUrl: o.camoModelUrl != null ? o.camoModelUrl : "",
    scale: o.scale || 1.2,
    stages: o.stages || INSECT_STAGES,
  };
}

export const insects: GuideSpecies[] = [
  sp({
    key: "honeybee", id: "honeybee", biome: "meadow", icon: "🐝", name: L("Honeybee", "Abeille domestique"), group: L("an insect", "un insecte"),
    feed: L("drinking nectar", "boit du nectar"), special: L("dancing", "danse"), catchable: true,
    habitat: L("On the lavender in the Idea Grove meadow", "Sur la lavande, dans la prairie du Bosquet des idées"),
    facts: [
      F("Honeybees visit flowers to drink nectar and gather pollen. They live together in a hive of thousands of bees.", "Les abeilles visitent les fleurs pour boire du nectar et récolter du pollen. Elles vivent ensemble dans une ruche de milliers d'abeilles.", "It visits flowers.", "Elle visite les fleurs.", "Encyclopaedia Britannica, “Honeybee”"),
      F("It carries pollen home in little “baskets” on its back legs: look for the orange balls!", "Elle rapporte le pollen dans de petites « corbeilles » sur ses pattes arrière : cherche les boules orange !", "It carries pollen on its legs.", "Elle porte du pollen sur ses pattes.", "Encyclopaedia Britannica, “Honeybee”"),
      insectId("It is an insect: six legs, three body parts (head, thorax, abdomen), two antennae and four wings.", "C'est un insecte : six pattes, trois parties du corps (tête, thorax, abdomen), deux antennes et quatre ailes."),
      F("Back at the hive, a bee does a “waggle dance” to show the others which way, and how far, to fly for food.", "De retour à la ruche, une abeille fait une « danse frétillante » pour montrer aux autres dans quelle direction, et à quelle distance, voler pour trouver à manger.", "It dances to show where the flowers are.", "Elle danse pour montrer où sont les fleurs.", "The Nobel Prize, Karl von Frisch (1973)"),
      F("A worker honeybee is about 1.3 cm long and weighs about 0.1 g: ten bees together weigh about one gram.", "Une abeille ouvrière mesure environ 1,3 cm et pèse environ 0,1 g : dix abeilles ensemble pèsent environ un gramme.", "It is about as long as your fingernail.", "Elle est à peu près aussi longue que ton ongle.", "PBS Nature, “Honeybee”"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 13, lengthText: L("about 1.3 cm (12 to 15 mm)", "environ 1,3 cm (12 à 15 mm)"), what: L("its body, head to tail (not the feelers)", "son corps, de la tête au bout (pas les antennes)"), massG: 0.1, massText: L("about 0.1 g", "environ 0,1 g"), source: "PBS Nature, “Honeybee”" },
    iconAxis: [0.101, 0.345, 0.78, 0.439],
  }),
  sp({
    key: "monarch_caterpillar", id: "monarch-caterpillar", biome: "meadow", icon: "🐛", name: L("Monarch caterpillar", "Chenille du monarque"), group: L("an insect (a young butterfly)", "un insecte (un jeune papillon)"),
    feed: L("munching milkweed", "grignote de l'asclépiade"), special: L("munching milkweed", "grignote de l'asclépiade"), catchable: true,
    habitat: L("On the milkweed in the Idea Grove meadow", "Sur l'asclépiade, dans la prairie du Bosquet des idées"),
    facts: [
      F("Monarch caterpillars eat only milkweed leaves. A monarch butterfly lays its eggs on milkweed and nowhere else.", "Les chenilles du monarque ne mangent que des feuilles d'asclépiade. Le papillon monarque pond ses œufs sur l'asclépiade, et nulle part ailleurs.", "It eats only milkweed.", "Elle ne mange que de l'asclépiade.", "Monarch Joint Venture, “Monarch life cycle”"),
      F("Its yellow, black and white stripes warn birds: the milkweed it eats makes it taste bad.", "Ses rayures jaunes, noires et blanches préviennent les oiseaux : l'asclépiade qu'elle mange lui donne mauvais goût.", "Its stripes say: do not eat me!", "Ses rayures disent : ne me mange pas !", "Monarch Joint Venture, “Monarch biology”"),
      F("It is an insect, the young (larva) of a butterfly: six pointy true legs near its head, plus soft stubby prolegs to hold on.", "C'est un insecte, le petit (la larve) d'un papillon : six vraies pattes pointues près de la tête, et de petites fausses pattes molles pour s'accrocher.", "It is a baby butterfly with 6 true legs.", "C'est un bébé papillon avec 6 vraies pattes.", "Encyclopaedia Britannica, “Caterpillar”"),
      F("When it is big enough, it hangs upside down and becomes a green chrysalis. About two weeks later, a butterfly comes out.", "Quand elle est assez grande, elle se pend la tête en bas et devient une chrysalide verte. Environ deux semaines plus tard, un papillon en sort.", "It turns into a butterfly!", "Elle se transforme en papillon !", "Monarch Joint Venture, “Monarch life cycle”"),
      F("Fully grown, it is about 4.5 cm long. It grows about 2,000 times heavier than when it hatched!", "Adulte, elle mesure environ 4,5 cm. Elle devient environ 2 000 fois plus lourde qu'à sa naissance !", "It grows very fast.", "Elle grandit très vite.", "Monarch Joint Venture, “Monarch life cycle”"),
    ],
    lens: [{ feature: "trueLegs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 45, lengthText: L("up to about 4.5 cm when fully grown", "jusqu'à environ 4,5 cm, adulte"), what: L("its body, head to tail (not the feelers)", "son corps, de la tête au bout (pas les filaments)"), massG: 0, massText: L("", ""), source: "Monarch Joint Venture, “Monarch life cycle”" },
    iconAxis: [0.153, 0.351, 0.945, 0.742],
  }),
  sp({
    key: "dung_beetle", id: "dung-beetle", biome: "canyon", icon: "🪲", name: L("Dung beetle", "Bousier"), group: L("an insect (a beetle)", "un insecte (un coléoptère)"),
    feed: L("", ""), special: L("rolling its ball", "roule sa boule"), catchable: true,
    habitat: L("On the sandy ground of the Biome Frontier canyon", "Sur le sol sableux du canyon de la Frontière des biomes"),
    facts: [
      F("Dung beetles live where big animals graze. They make balls of dung and roll them away, to eat or to lay their eggs in.", "Les bousiers vivent là où broutent de grands animaux. Ils font des boules de bouse et les roulent plus loin, pour les manger ou y pondre leurs œufs.", "It rolls balls of dung.", "Il roule des boules de bouse.", "Encyclopaedia Britannica, “Dung beetle”"),
      F("It rolls its ball backwards: head down, pushing with its back legs.", "Il roule sa boule à reculons : la tête en bas, il pousse avec ses pattes arrière.", "It pushes its ball with its back legs.", "Il pousse sa boule avec ses pattes arrière.", "National Geographic, “Dung beetles watch the galaxy” (2013)"),
      insectId("It is an insect: six legs and three body parts. Like all beetles, its hard front wings cover and protect its flying wings.", "C'est un insecte : six pattes et trois parties du corps. Comme tous les coléoptères, ses ailes avant dures couvrent et protègent ses ailes pour voler."),
      F("Dung beetles clean up the land: buried dung feeds the soil. Some even roll in a straight line at night by watching the Milky Way!", "Les bousiers nettoient la terre : la bouse enterrée nourrit le sol. Certains roulent même tout droit la nuit en regardant la Voie lactée !", "It cleans up and feeds the soil.", "Il nettoie et nourrit le sol.", "Dacke et al., Current Biology (2013)"),
      F("This ball-roller is about 2.5 cm long. A cousin, the bull-headed dung beetle, can pull 1,141 times its own weight!", "Ce rouleur de boule mesure environ 2,5 cm. Un cousin, le bousier taureau, peut tirer 1 141 fois son propre poids !", "It is very, very strong.", "Il est très, très fort.", "Knell & Simmons, Proceedings of the Royal Society B (2010)"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 25, lengthText: L("about 2.5 cm (dung beetles range from a few millimetres to about 3 cm)", "environ 2,5 cm (les bousiers vont de quelques millimètres à environ 3 cm)"), what: L("its body, head to tail (not the ball!)", "son corps, de la tête au bout (pas la boule !)"), massG: 0, massText: L("", ""), source: "Encyclopaedia Britannica, “Dung beetle”" },
    iconAxis: [0.38, 0.37, 0.88, 0.66],
  }),
  sp({
    key: "locust", id: "locust", biome: "canyon", icon: "🦗", name: L("Desert locust", "Criquet pèlerin"), group: L("an insect", "un insecte"),
    feed: L("eating plants", "mange des plantes"), special: L("jumping", "saute"), catchable: true,
    habitat: L("In the dry canyon of the Biome Frontier", "Dans le canyon sec de la Frontière des biomes"),
    facts: [
      F("Desert locusts live in the dry lands of Africa, the Middle East and south-west Asia.", "Les criquets pèlerins vivent dans les terres sèches d'Afrique, du Moyen-Orient et d'Asie du Sud-Ouest.", "It lives in dry lands.", "Il vit dans les terres sèches.", "FAO Locust Watch, “Desert Locust”"),
      F("Its long, strong back legs work like a catapult: a desert locust can jump about 1 metre.", "Ses longues pattes arrière, très fortes, marchent comme une catapulte : un criquet pèlerin peut sauter environ 1 mètre.", "It jumps with its long back legs.", "Il saute avec ses longues pattes arrière.", "Bennet-Clark, Journal of Experimental Biology (1975)"),
      insectId("It is an insect: six legs, three body parts, two antennae and four wings.", "C'est un insecte : six pattes, trois parties du corps, deux antennes et quatre ailes."),
      F("When many locusts crowd together, they change colour and fly in huge swarms that can travel up to 150 km in a day.", "Quand beaucoup de criquets se serrent, ils changent de couleur et volent en énormes essaims qui peuvent parcourir jusqu'à 150 km en un jour.", "Many of them fly together in swarms.", "Ils volent ensemble en essaims.", "FAO Locust Watch, “FAQs about locusts”"),
      F("An adult is about 5.5 cm long and weighs about 2 g. Each day it can eat about its own weight in fresh plants!", "Un adulte mesure environ 5,5 cm et pèse environ 2 g. Chaque jour, il peut manger à peu près son poids en plantes fraîches !", "It eats its own weight every day.", "Il mange son poids chaque jour.", "FAO Locust Watch, “FAQs about locusts”"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 55, lengthText: L("about 5.5 cm (4.5 to 6 cm)", "environ 5,5 cm (4,5 à 6 cm)"), what: L("its body, head to the wing tips (not the feelers)", "son corps, de la tête au bout des ailes (pas les antennes)"), massG: 2, massText: L("about 2 g", "environ 2 g"), source: "FAO Locust Watch (weight); Wikipedia, “Desert locust” (length)" },
    iconAxis: [0.087, 0.232, 0.794, 0.562],
  }),
  sp({
    key: "tiger_beetle", id: "tiger-beetle", biome: "canyon", icon: "🪲", name: L("Green tiger beetle", "Cicindèle champêtre"), group: L("an insect (a beetle)", "un insecte (un coléoptère)"),
    feed: L("hunting", "chasse"), special: L("sprinting", "sprinte"), catchable: true,
    habitat: L("On bare sand near the canyon bridge, in the sun", "Sur le sable nu près du pont du canyon, au soleil"),
    facts: [
      F("Green tiger beetles hunt on bare, sandy ground on warm, sunny days.", "Les cicindèles chassent sur le sol nu et sableux, les jours chauds et ensoleillés.", "It loves warm, sunny sand.", "Elle aime le sable chaud et ensoleillé.", "The Wildlife Trusts, “Green tiger beetle”"),
      F("It has big eyes and long legs. It chases small insects and grabs them with its large jaws.", "Elle a de grands yeux et de longues pattes. Elle poursuit de petits insectes et les attrape avec ses grandes mandibules.", "It chases other bugs.", "Elle chasse d'autres petites bêtes.", "The Wildlife Trusts, “Green tiger beetle”"),
      insectId("It is an insect: six legs and three body parts, with shiny hard wing cases like all beetles.", "C'est un insecte : six pattes et trois parties du corps, avec des étuis d'ailes durs et brillants comme tous les coléoptères."),
      F("Tiger beetles run so fast that their eyes cannot keep up: they stop for a moment to look again, then run on.", "Les cicindèles courent si vite que leurs yeux ne suivent plus : elles s'arrêtent un instant pour regarder, puis repartent.", "It runs so fast it must stop to look.", "Elle court si vite qu'elle doit s'arrêter pour regarder.", "Cornell University, Zurek & Gilbert (2014)"),
      F("It is only about 1.3 cm long. One Australian tiger beetle was timed at 2.5 metres per second: about 120 body lengths every second!", "Elle ne mesure qu'environ 1,3 cm. Une cicindèle australienne a été chronométrée à 2,5 mètres par seconde : environ 120 fois sa longueur chaque seconde !", "It is a super-fast runner.", "C'est une coureuse super rapide.", "University of Florida Book of Insect Records, “Fastest runner”"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 13, lengthText: L("about 1.3 cm (10 to 15 mm)", "environ 1,3 cm (10 à 15 mm)"), what: L("its body, head to tail (not the feelers)", "son corps, de la tête au bout (pas les antennes)"), massG: 0, massText: L("", ""), source: "The Wildlife Trusts, “Green tiger beetle”" },
    iconAxis: [0.223, 0.305, 0.756, 0.431],
  }),
  sp({
    key: "firefly", id: "firefly", biome: "rainforest", icon: "✨", name: L("Firefly", "Luciole"), group: L("an insect (a beetle)", "un insecte (un coléoptère)"),
    feed: L("", ""), special: L("flashing its light", "fait clignoter sa lumière"), catchable: true,
    habitat: L("In deep shade under the big rainforest trees", "Dans l'ombre profonde, sous les grands arbres de la forêt"),
    facts: [
      F("Fireflies come out at dusk in warm, damp places. By day they rest in shady grass and leaves.", "Les lucioles sortent au crépuscule dans les endroits chauds et humides. Le jour, elles se reposent dans l'herbe et les feuilles à l'ombre.", "It glows at dusk.", "Elle brille au crépuscule.", "Animal Diversity Web, “Photinus pyralis”"),
      F("Its light comes from the end of its body: a chemical reaction makes light with almost no heat. This is called bioluminescence.", "Sa lumière vient du bout de son corps : une réaction chimique fait de la lumière presque sans chaleur. On appelle cela la bioluminescence.", "Its tail makes light.", "Le bout de son corps fait de la lumière.", "Encyclopaedia Britannica, “Firefly”"),
      insectId("It is not a fly but a beetle, so an insect: six legs, three body parts, two antennae and hard wing cases.", "Ce n'est pas une mouche mais un coléoptère, donc un insecte : six pattes, trois parties du corps, deux antennes et des étuis d'ailes durs."),
      F("Males fly at dusk and flash a “J” about every 5.5 seconds; females answer from the grass. Each kind of firefly has its own flash code.", "Les mâles volent au crépuscule et dessinent un « J » lumineux environ toutes les 5,5 secondes ; les femelles répondent depuis l'herbe. Chaque espèce a son propre code.", "It talks with flashes of light.", "Elle parle avec des éclairs de lumière.", "Animal Diversity Web, “Photinus pyralis”"),
      F("This firefly is about 1.2 cm long (10 to 14 mm).", "Cette luciole mesure environ 1,2 cm (10 à 14 mm).", "It is small: about 1 cm.", "Elle est petite : environ 1 cm.", "BugGuide, “Photinus pyralis”"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 12, lengthText: L("about 1.2 cm (10 to 14 mm)", "environ 1,2 cm (10 à 14 mm)"), what: L("its body, head to tail (not the feelers)", "son corps, de la tête au bout (pas les antennes)"), massG: 0, massText: L("", ""), source: "BugGuide, “Photinus pyralis”" },
    iconAxis: [0.086, 0.263, 0.862, 0.477],
  }),
  sp({
    key: "leafcutter_ant", id: "leafcutter-ant", biome: "rainforest", icon: "🐜", name: L("Leafcutter ant", "Fourmi coupe-feuille"), group: L("an insect", "un insecte"),
    feed: L("cutting a leaf", "découpe une feuille"), special: L("cutting a leaf", "découpe une feuille"), catchable: true,
    habitat: L("On the rainforest trail, carrying leaves", "Sur le sentier de la forêt, en portant des feuilles"),
    facts: [
      F("Leafcutter ants live in the rainforests of Central and South America, in huge underground nests.", "Les fourmis coupe-feuille vivent dans les forêts tropicales d'Amérique centrale et du Sud, dans d'immenses nids sous la terre.", "It lives in the rainforest.", "Elle vit dans la forêt tropicale.", "Smithsonian Tropical Research Institute, “Leafcutter ants”"),
      F("It cuts a piece of leaf with its jaws and carries it home, held high like a flag.", "Elle découpe un morceau de feuille avec ses mandibules et le rapporte au nid, levé comme un drapeau.", "It carries leaves like a flag.", "Elle porte des feuilles comme un drapeau.", "Smithsonian Tropical Research Institute, “Leafcutter ants”"),
      insectId("It is an insect: six legs, three body parts and two bent (elbowed) antennae.", "C'est un insecte : six pattes, trois parties du corps et deux antennes coudées."),
      F("The ants do not eat the leaves! They feed them to a fungus garden in their nest, and they eat the fungus.", "Les fourmis ne mangent pas les feuilles ! Elles en nourrissent un jardin de champignons dans leur nid, et mangent le champignon.", "It grows a fungus garden.", "Elle cultive un jardin de champignons.", "Encyclopaedia Britannica, “Leaf-cutter ant”"),
      F("A leaf-carrying worker is about 1 cm long, and can carry a leaf piece up to about 8 times its own weight.", "Une ouvrière qui porte des feuilles mesure environ 1 cm, et peut porter un morceau de feuille d'environ 8 fois son poids.", "It carries 8 times its weight.", "Elle porte 8 fois son poids.", "Smithsonian Tropical Research Institute (8 × its weight)"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 10, lengthText: L("about 1 cm (workers range from about 2 mm to 1.6 cm)", "environ 1 cm (les ouvrières vont d'environ 2 mm à 1,6 cm)"), what: L("its body, head to tail (not the leaf!)", "son corps, de la tête au bout (pas la feuille !)"), massG: 0, massText: L("", ""), source: "Wikipedia, “Leafcutter ant” (worker sizes)" },
    iconAxis: [0.25, 0.27, 0.744, 0.6],
  }),
  sp({
    key: "stick_insect", id: "stick-insect", biome: "rainforest", icon: "🌿", name: L("Indian stick insect", "Phasme indien"), group: L("an insect", "un insecte"),
    feed: L("eating a leaf", "mange une feuille"), special: L("keeping still like a twig", "reste immobile comme une brindille"), catchable: true,
    camoModelUrl: A("insect:stick_insect:camo"),
    habitat: L("Among the plants at the rainforest's edge: look very closely!", "Parmi les plantes, à l'orée de la forêt : regarde très attentivement !"),
    facts: [
      F("Stick insects live among bushes and trees. The Indian stick insect eats leaves such as bramble and privet.", "Les phasmes vivent dans les buissons et les arbres. Le phasme indien mange des feuilles comme celles de la ronce et du troène.", "It lives in bushes and eats leaves.", "Il vit dans les buissons et mange des feuilles.", "Phasmid Study Group, “Carausius morosus”"),
      F("By day it stays very still and looks just like a twig. That is camouflage!", "Le jour, il reste immobile et ressemble à une brindille. C'est du camouflage !", "It hides by looking like a twig.", "Il se cache en ressemblant à une brindille.", "Phasmid Study Group, “Carausius morosus”"),
      insectId("It is an insect: six long legs, three body parts and two antennae. This kind has no wings.", "C'est un insecte : six longues pattes, trois parties du corps et deux antennes. Cette espèce n'a pas d'ailes."),
      F("It wakes up at night to eat. If a young one loses a leg, it can grow a new one when it moults.", "Il se réveille la nuit pour manger. Si un jeune perd une patte, une nouvelle peut repousser quand il mue.", "It eats at night.", "Il mange la nuit.", "Encyclopaedia Britannica, “Walking stick”"),
      F("A grown-up female is about 8 cm long. Males are smaller, and very rare.", "Une femelle adulte mesure environ 8 cm. Les mâles sont plus petits, et très rares.", "It is as long as a finger.", "Il est long comme un doigt.", "Phasmid Study Group, “Carausius morosus”"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 80, lengthText: L("about 8 cm (adult female)", "environ 8 cm (femelle adulte)"), what: L("its body, head to tail (not the legs or feelers)", "son corps, de la tête au bout (pas les pattes ni les antennes)"), massG: 0, massText: L("", ""), source: "Phasmid Study Group, “Carausius morosus”" },
    iconAxis: [0.054, 0.191, 0.72, 0.6],
  }),
  sp({
    key: "snail", id: "snail", biome: "rainforest", icon: "🐌", name: L("Garden snail", "Escargot petit-gris"), group: L("a mollusc, not an insect", "un mollusque, pas un insecte"),
    feed: L("", ""), special: L("tucking in its eyes", "rentre ses yeux"), catchable: true,
    habitat: L("In the damp shade by the waterfall pool", "Dans l'ombre humide, près du bassin de la cascade"),
    facts: [
      F("Garden snails like damp, shady places. They come out after rain and at night.", "Les escargots aiment les endroits humides et ombragés. Ils sortent après la pluie et la nuit.", "It likes wet, shady places.", "Il aime les endroits humides et à l'ombre.", "Canadian Food Inspection Agency, “European brown garden snail”"),
      F("It glides on one big muscular foot, over a trail of slime that protects it.", "Il glisse sur un seul grand pied musclé, sur une trace de bave qui le protège.", "It glides on slime.", "Il glisse sur de la bave.", "Encyclopaedia Britannica, “Snail”"),
      F("It is NOT an insect! No legs at all, and a shell: it is a mollusc, a cousin of the octopus.", "Ce n'est PAS un insecte ! Pas de pattes du tout, et une coquille : c'est un mollusque, un cousin de la pieuvre.", "Not an insect: no legs, a shell.", "Pas un insecte : pas de pattes, une coquille.", "Encyclopaedia Britannica, “Gastropod”"),
      F("Its eyes are at the tips of its long tentacles. It can pull them in when something touches them.", "Ses yeux sont au bout de ses longues cornes. Il peut les rentrer quand on les touche.", "Its eyes are on its long horns.", "Ses yeux sont au bout de ses cornes.", "Encyclopaedia Britannica, “Snail”"),
      F("Its shell is about 3.5 cm across (2.5 to 4 cm) and an adult weighs about 10 g.", "Sa coquille mesure environ 3,5 cm de large (2,5 à 4 cm) et un adulte pèse environ 10 g.", "It weighs about 10 g.", "Il pèse environ 10 g.", "Canadian Food Inspection Agency (size); Sinop University snail study, 2018 (weight)"),
    ],
    lens: [{ feature: "legs", value: 0 }, { feature: "shell", value: 1 }],
    measure: { lengthMm: 35, lengthText: L("about 3.5 cm across its shell (2.5 to 4 cm)", "environ 3,5 cm de large pour sa coquille (2,5 à 4 cm)"), what: L("across its shell", "la largeur de sa coquille"), massG: 10, massText: L("about 10 g", "environ 10 g"), source: "Canadian Food Inspection Agency; Sinop University snail study (2018)" },
    iconAxis: [0.155, 0.4, 0.53, 0.4],
  }),
  sp({
    key: "flea", id: "flea", biome: "arena", icon: "🦟", name: L("Cat flea", "Puce du chat"), group: L("an insect", "un insecte"),
    feed: L("", ""), special: L("jumping", "saute"), catchable: false, stages: [1, 2, 4], scale: 1,
    habitat: L("The famous jumper of the Bug Games (in real life: in the fur of cats and dogs)", "La célèbre sauteuse des Jeux des insectes (dans la vie : dans le pelage des chats et des chiens)"),
    facts: [
      F("Cat fleas live in the fur of cats and dogs and drink a little of their blood. A vet can help pets get rid of them.", "Les puces du chat vivent dans le pelage des chats et des chiens et boivent un peu de leur sang. Un vétérinaire peut aider à en débarrasser les animaux.", "It lives in cat and dog fur.", "Elle vit dans le pelage des chats et des chiens.", "University of Florida IFAS, “Cat flea”"),
      F("Its body is flat from side to side, so it slips easily between hairs. It is only 2 to 3 mm long.", "Son corps est plat sur les côtés : elle se faufile facilement entre les poils. Elle ne mesure que 2 à 3 mm.", "It is tiny and flat.", "Elle est minuscule et plate.", "University of Florida IFAS, “Cat flea”"),
      insectId("It is an insect without wings: six legs and three body parts. Its long back legs are made for jumping.", "C'est un insecte sans ailes : six pattes et trois parties du corps. Ses longues pattes arrière sont faites pour sauter."),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "bodyParts", value: 3 }],
    measure: { lengthMm: 2.5, lengthText: L("2 to 3 mm", "2 à 3 mm"), what: L("its body", "son corps"), massG: 0, massText: L("", ""), source: "University of Florida IFAS, “Cat flea”" },
    iconAxis: [0.14, 0.26, 0.87, 0.6],
  }),
];

export const phase2Ui: Pick<ExpeditionUi,
  | "net" | "netHint" | "sweep" | "sweepHint" | "sweepKeys" | "sweepFast" | "sweepMiss" | "sweepNone" | "caught" | "jarFull" | "jar" | "jarLook" | "jarCount"
  | "isInsect" | "notInsect" | "release" | "releaseHere" | "releaseFar" | "released" | "releaseFirst" | "wentHome" | "lookFirst"
  | "measureTitle" | "measureHint" | "measureShort" | "measureLong" | "measureRight" | "magnified"
  | "weighTitle" | "weighHint" | "weighHeavy" | "weighLight" | "weighRight" | "weighNone" | "weighClear" | "needTape"
  | "stageReleased" | "stageMeasured" | "lockedReleased" | "lockedMeasured" | "where" | "sizes" | "sizesHint" | "weights" | "measuredValue" | "weighedValue" | "guideAnimals" | "guideInsects"
> = {
  net: L("Butterfly net", "Filet à papillons"),
  netHint: L("Walk slowly up to an insect. When the ring turns green, sweep the net.", "Approche-toi doucement d'un insecte. Quand le cercle devient vert, balaie avec le filet."),
  sweep: L("Sweep", "Balayer"),
  sweepHint: L("Drag the net gently from one side to the other.", "Fais glisser le filet doucement d'un côté à l'autre."),
  sweepKeys: L("Or hold Space, then let go.", "Ou maintiens Espace, puis relâche."),
  sweepFast: L("Too fast! It flew off. Try again, slowly and gently.", "Trop vite ! Il s'est envolé. Recommence, doucement."),
  sweepMiss: L("Almost! Sweep all the way across, slowly.", "Presque ! Balaie jusqu'au bout, doucement."),
  sweepNone: L("No insect close enough. Walk slowly up to one.", "Aucun insecte assez près. Approche-toi doucement d'un insecte."),
  caught: L("Caught gently! Look at it in the jar.", "Attrapé en douceur ! Observe-le dans le bocal."),
  jarFull: L("Let the creature in your jar go home first.", "Relâche d'abord la créature de ton bocal."),
  jar: L("Bug jar", "Bocal à insectes"),
  jarLook: L("Look closely", "Regarde de près"),
  jarCount: L("Count what you see, then check.", "Compte ce que tu vois, puis vérifie."),
  isInsect: L("6 legs and 3 body parts: it is an insect!", "6 pattes et 3 parties du corps : c'est un insecte !"),
  notInsect: L("No legs and a shell: it is not an insect. It is {group}.", "Pas de pattes et une coquille : ce n'est pas un insecte. C'est {group}."),
  release: L("Let it go", "Relâcher"),
  releaseHere: L("Let it go right here, where you found it.", "Relâche-le ici, là où tu l'as trouvé."),
  releaseFar: L("This is not its home. Carry it back to where you found it ({m} m).", "Ce n'est pas chez lui. Ramène-le là où tu l'as trouvé ({m} m)."),
  released: L("Back home, safe and sound!", "De retour chez lui, sain et sauf !"),
  releaseFirst: L("Look at it closely first, then let it go.", "Observe-le d'abord de près, puis relâche-le."),
  wentHome: L("The {name} crawled out of the jar and went home. Next time, let it go where you found it!", "{name} est sorti du bocal et est rentré chez lui. La prochaine fois, relâche-le là où tu l'as trouvé !"),
  lookFirst: L("Look closely first", "Observe d'abord"),
  measureTitle: L("Measure it", "Mesure-le"),
  measureHint: L("Drag the end of the tape to the other end of {what}.", "Tire le bout du ruban jusqu'à l'autre bout de {what}."),
  measureShort: L("A bit further: reach the very end.", "Un peu plus loin : va jusqu'au bout."),
  measureLong: L("Too far! Stop at the end of {what}.", "Trop loin ! Arrête-toi au bout de {what}."),
  measureRight: L("Measured: {value}!", "Mesuré : {value} !"),
  magnified: L("Picture magnified ×{n}: the tape shows real size", "Image agrandie ×{n} : le ruban montre la vraie taille"),
  weighTitle: L("Weigh it", "Pèse-le"),
  weighHint: L("Add weights to the other pan until the beam is level.", "Ajoute des poids sur l'autre plateau jusqu'à ce que le fléau soit droit."),
  weighHeavy: L("The weights are heavier: the beam tips their way. Take one off.", "Les poids sont plus lourds : le fléau penche de leur côté. Enlèves-en un."),
  weighLight: L("The creature is heavier: add more weight.", "La créature est plus lourde : ajoute du poids."),
  weighRight: L("Level! It weighs {value}.", "Droit ! Elle pèse {value}."),
  weighNone: L("This one is too light for our scale. Weigh a snail or a locust!", "Celle-ci est trop légère pour notre balance. Pèse un escargot ou un criquet !"),
  weighClear: L("Take the weights off", "Enlever les poids"),
  needTape: L("Catch a creature first: you measure it in the jar.", "Attrape d'abord une créature : on la mesure dans le bocal."),
  stageReleased: L("Caught and released", "Attrapé et relâché"),
  stageMeasured: L("Measured", "Mesuré"),
  lockedReleased: L("Catch it gently, look at it in the jar, then let it go where you found it.", "Attrape-le doucement, observe-le dans le bocal, puis relâche-le là où tu l'as trouvé."),
  lockedMeasured: L("Measure it with the tape while it is in the jar.", "Mesure-le avec le mètre pendant qu'il est dans le bocal."),
  where: L("Where to look", "Où chercher"),
  sizes: L("Compare sizes", "Comparer les tailles"),
  sizesHint: L("Real lengths of the creatures you measured, smallest first.", "Vraies longueurs des créatures que tu as mesurées, de la plus petite à la plus grande."),
  weights: L("Weights", "Poids"),
  measuredValue: L("Length: {value}", "Longueur : {value}"),
  weighedValue: L("Weight: {value}", "Poids : {value}"),
  guideAnimals: L("Animals and plants", "Animaux et plantes"),
  guideInsects: L("Insects and small creatures", "Insectes et petites bêtes"),
};
