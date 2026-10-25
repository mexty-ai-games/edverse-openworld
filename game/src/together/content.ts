// Phase 3, "Together" (EN + FR): the community garden and its true plant-pollinator pairings, the
// pollinators' Field Guide pages, team-up finds, the Explorers' Museum, the BioBlitz, and the Grove
// Keeper's quests that introduce them. Every fact carries the source it can be checked in. These are
// props defaults: the saved variant holds the same content (props key `together`, and the new quests,
// lines, tools and species appended to `quests` / `expedition`).
import type { Dialogue, GuideFact, GuideSpecies, KeeperLine, LocalizedText, Quest, Tool, TogetherProps, UiLine } from "../block";
import { P3_ASSETS } from "./assets.gen";

const L = (en: string, fr: string) => ({ en, fr });
const F = (en: string, fr: string, easyEn: string, easyFr: string, source: string): GuideFact => ({ text: L(en, fr), easy: L(easyEn, easyFr), source });
const A = (k: string) => P3_ASSETS[k] || "";

// ------------------------------------------------------------------ the Keeper's quests
export const phase3Quests: Quest[] = [
  {
    id: "grow-garden",
    icon: "🌻",
    title: L("A garden for pollinators", "Un jardin pour les pollinisateurs"),
    intro: "garden",
    done: "gardenDone",
    giveAtStart: ["seeds", "can"],
    reward: [],
    report: true,
    steps: [
      { id: "plant-one", kind: "plant", target: "any", count: 1, zone: "idea-grove", icon: "🌱", text: L("Plant a seed in the community garden (north-east of the Idea Tree)", "Plante une graine dans le jardin partagé (au nord-est de l'Arbre à idées)"), line: "plantStep" },
      { id: "water-one", kind: "water", target: "any", count: 1, zone: "idea-grove", icon: "💧", text: L("Water a plant in the garden", "Arrose une plante du jardin"), line: "waterStep" },
      { id: "pollinator", kind: "pollinate", target: "any", count: 1, zone: "idea-grove", icon: "🐝", text: L("Photograph a pollinator drinking from a garden flower", "Photographie un pollinisateur qui boit dans une fleur du jardin"), line: "pollinateStep" },
    ],
  },
  {
    id: "together",
    icon: "🤝",
    title: L("Explorers together", "Explorateurs ensemble"),
    intro: "together",
    done: "allDone3",
    giveAtStart: ["lantern"],
    reward: [],
    report: true,
    steps: [
      { id: "museum-photo", kind: "museum", target: "any", count: 1, zone: "", icon: "🖼️", text: L("Put a photo in the Explorers' Museum (north-west of the Idea Tree)", "Mets une photo au Musée des explorateurs (au nord-ouest de l'Arbre à idées)"), line: "museumStep" },
      { id: "sticker", kind: "sticker", target: "any", count: 1, zone: "", icon: "⭐", text: L("Leave a sticker on a museum display you like", "Laisse un autocollant sur une vitrine du musée que tu aimes"), line: "stickerStep" },
      { id: "team-up", kind: "coop", target: "any", count: 1, zone: "", icon: "🏮", text: L("Make a team-up find: the firefly by lantern light (Biome Frontier)", "Fais une découverte en équipe : la luciole à la lumière de la lanterne (Frontière des biomes)"), line: "coopStep" },
      { id: "bioblitz", kind: "bioblitz", target: "any", count: 1, zone: "", icon: "🔎", text: L("Take part in a BioBlitz (the banner by the Idea Tree)", "Participe à un BioBlitz (la bannière près de l'Arbre à idées)"), line: "blitzStep" },
    ],
  },
];

export const phase3Lines: KeeperLine[] = [
  { id: "garden1", anim: "wave", text: L("Pollinators need flowers! Here are seeds and a watering can for the community garden.", "Les pollinisateurs ont besoin de fleurs ! Voici des graines et un arrosoir pour le jardin partagé.") },
  { id: "garden2", anim: "point", text: L("Everyone plants there together. Plant the right flowers, and the right visitors will come!", "Tout le monde y plante ensemble. Plante les bonnes fleurs, et les bons visiteurs viendront !") },
  { id: "plantStep", anim: "talk", text: L("The garden is north-east of the Idea Tree. Pick a seed and plant it in a free spot.", "Le jardin est au nord-est de l'Arbre à idées. Choisis une graine et plante-la dans une place libre.") },
  { id: "waterStep", anim: "talk", text: L("Now water a plant. Water helps it grow a little faster.", "Maintenant, arrose une plante. L'eau l'aide à pousser un peu plus vite.") },
  { id: "pollinateStep", anim: "talk", text: L("Watch the flowers. Photograph a pollinator while it drinks nectar.", "Observe les fleurs. Photographie un pollinisateur pendant qu'il boit le nectar.") },
  { id: "gardenDone", anim: "wave", text: L("You saw it: each pollinator has flowers it loves. Come back to see your plant bloom!", "Tu l'as vu : chaque pollinisateur a ses fleurs préférées. Reviens voir ta plante fleurir !") },
  { id: "together1", anim: "wave", text: L("Explorers are stronger together. Here is a lantern with a soft red light.", "Les explorateurs sont plus forts ensemble. Voici une lanterne à la douce lumière rouge.") },
  { id: "museumStep", anim: "talk", text: L("Put your best photo in the Explorers' Museum, north-west of the Idea Tree.", "Mets ta meilleure photo au Musée des explorateurs, au nord-ouest de l'Arbre à idées.") },
  { id: "stickerStep", anim: "talk", text: L("Visit the displays and leave a sticker on one you like.", "Visite les vitrines et laisse un autocollant sur celle que tu aimes.") },
  { id: "coopStep", anim: "point", text: L("Some finds need two explorers. In the Biome Frontier, one holds the lantern while the other photographs the firefly.", "Certaines découvertes demandent deux explorateurs. Dans la Frontière des biomes, l'un tient la lanterne pendant que l'autre photographie la luciole.") },
  { id: "blitzStep", anim: "talk", text: L("Now join a BioBlitz at the banner: everyone counts species together!", "Maintenant, participe à un BioBlitz près de la bannière : tout le monde compte les espèces ensemble !") },
  { id: "allDone3", anim: "wave", text: L("What a team! Real scientists work together, just like you.", "Quelle équipe ! Les vrais scientifiques travaillent ensemble, comme toi.") },
  { id: "helper", anim: "talk", text: L("No one to team up with? My helper will hold it for you!", "Personne pour faire équipe ? Mon assistant va le tenir pour toi !") },
];

export const phase3Dialogues: Dialogue[] = [
  { id: "garden", lines: ["garden1", "garden2", "plantStep"] },
  { id: "gardenDone", lines: ["gardenDone"] },
  { id: "together", lines: ["together1", "museumStep"] },
  { id: "allDone3", lines: ["allDone3"] },
];

export const phase3Tools: Tool[] = [
  { id: "seeds", icon: "🌱", iconUrl: A("garden:seed-packet:sunflower:icon"), modelUrl: A("garden:seed-packet:sunflower"), name: L("Seed packets", "Sachets de graines"), about: L("Six kinds of seeds for the community garden. Each flower feeds different visitors.", "Six sortes de graines pour le jardin partagé. Chaque fleur nourrit des visiteurs différents.") },
  { id: "can", icon: "🚿", iconUrl: A("garden:watering-can:icon"), modelUrl: A("garden:watering-can"), name: L("Watering can", "Arrosoir"), about: L("Water a plant and it grows a little faster.", "Arrose une plante et elle pousse un peu plus vite.") },
  { id: "lantern", icon: "🏮", iconUrl: A("tool:lantern:icon"), modelUrl: A("tool:lantern"), name: L("Red lantern", "Lanterne rouge"), about: L("A dim red light: fireflies keep flashing, and a friend can take their photo.", "Une faible lumière rouge : les lucioles continuent de clignoter, et un ami peut les photographier.") },
];

// ------------------------------------------------------------------ the garden's visitors (Field Guide pages)
const pol = (key: string, s: Omit<GuideSpecies, "iconUrl" | "silhouetteUrl" | "modelUrl">): GuideSpecies => ({ ...s, modelUrl: A(key), iconUrl: A(key + ":icon"), silhouetteUrl: "" });

export const pollinators: GuideSpecies[] = [
  pol("pollinator:bumblebee", {
    id: "bumblebee", biome: "garden", icon: "🐝", name: L("Bumblebee", "Bourdon"), group: L("an insect (a bee)", "un insecte (une abeille)"), scale: 4,
    feed: L("drinking nectar", "boit du nectar"), special: L("", ""), stages: [1, 2, 4, 8],
    habitat: L("In the community garden: sunflower, lavender, foxglove, clover and tomato flowers", "Dans le jardin partagé : fleurs de tournesol, lavande, digitale, trèfle et tomate"),
    facts: [
      F("A bumblebee is big and furry. Its fuzzy coat and warm flight muscles let it fly on cool days when other bees stay home.", "Le bourdon est gros et poilu. Son manteau de poils et ses muscles de vol chauds lui permettent de voler par temps frais, quand les autres abeilles restent chez elles.", "Its fur keeps it warm.", "Ses poils lui tiennent chaud.", "Bumblebee Conservation Trust, “About bumblebees”"),
      F("It carries pollen home in “pollen baskets” on its back legs.", "Il rapporte le pollen dans des « corbeilles à pollen » sur ses pattes arrière.", "It carries pollen on its legs.", "Il porte du pollen sur ses pattes.", "Bumblebee Conservation Trust, “About bumblebees”"),
      F("It is an insect: 6 legs, 4 wings and 3 body parts.", "C'est un insecte : 6 pattes, 4 ailes et 3 parties du corps.", "6 legs, 4 wings: an insect!", "6 pattes, 4 ailes : un insecte !", "Encyclopaedia Britannica, “Bumblebee”"),
      F("Tomato flowers hold their pollen tight. A bumblebee buzzes its flight muscles to shake it out: “buzz pollination”. Honeybees cannot do this.", "Les fleurs de tomate gardent leur pollen bien serré. Le bourdon fait vibrer ses muscles de vol pour le faire tomber : c'est la « pollinisation vibratile ». Les abeilles domestiques ne savent pas le faire.", "It buzzes the pollen out!", "Il fait vibrer les fleurs !", "Xerces Society; Bay Nature, “Buzz pollination”"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "wings", value: 4 }],
  }),
  pol("pollinator:hoverfly", {
    id: "hoverfly", biome: "garden", icon: "🪰", name: L("Hoverfly", "Syrphe"), group: L("an insect (a fly)", "un insecte (une mouche)"), scale: 5,
    feed: L("drinking nectar", "boit du nectar"), special: L("", ""), stages: [1, 2, 4, 8, 16], catchable: true,
    habitat: L("In the community garden: lavender and clover flowers", "Dans le jardin partagé : fleurs de lavande et de trèfle"),
    facts: [
      F("A hoverfly can hang still in the air like a tiny helicopter, then dart away in a flash.", "Le syrphe peut rester immobile dans l'air comme un petit hélicoptère, puis filer en un éclair.", "It hovers in the air.", "Il fait du sur-place dans l'air.", "Australian Museum, “Hover flies”"),
      F("Its yellow and black stripes copy a wasp's, so birds leave it alone. But a hoverfly cannot sting or bite.", "Ses rayures jaunes et noires imitent celles d'une guêpe, alors les oiseaux le laissent tranquille. Mais un syrphe ne pique pas et ne mord pas.", "It looks like a wasp but cannot sting.", "Il ressemble à une guêpe mais ne pique pas.", "Royal Horticultural Society, “Hoverflies”"),
      F("It is a fly: flies have only 2 wings, while bees and wasps have 4. Count them!", "C'est une mouche : les mouches n'ont que 2 ailes, les abeilles et les guêpes en ont 4. Compte-les !", "Only 2 wings: a fly!", "Seulement 2 ailes : une mouche !", "Encyclopaedia Britannica, “Dipteran”"),
      F("Hoverflies drink nectar and carry pollen from flower to flower, like bees do.", "Les syrphes boivent le nectar et transportent le pollen de fleur en fleur, comme les abeilles.", "It helps flowers, like a bee.", "Il aide les fleurs, comme une abeille.", "Royal Horticultural Society, “Hoverflies”"),
      F("Many hoverfly larvae eat aphids, the tiny bugs that suck plants' sap: gardeners are happy to see them.", "Beaucoup de larves de syrphes mangent des pucerons, les petites bêtes qui sucent la sève des plantes : les jardiniers sont contents de les voir.", "Its babies eat aphids.", "Ses bébés mangent des pucerons.", "Royal Horticultural Society, “Hoverflies”"),
    ],
    lens: [{ feature: "legs", value: 6 }, { feature: "wings", value: 2 }],
  }),
  pol("pollinator:hummingbird", {
    id: "hummingbird", biome: "garden", icon: "🐦", name: L("Hummingbird", "Colibri"), group: L("a bird", "un oiseau"), scale: 2.6,
    feed: L("drinking nectar", "boit du nectar"), special: L("", ""),
    habitat: L("In the community garden, when the foxgloves flower", "Dans le jardin partagé, quand les digitales fleurissent"),
    facts: [
      F("A hummingbird can hover in mid-air and even fly backwards.", "Le colibri peut faire du sur-place en l'air, et même voler en arrière.", "It can fly backwards!", "Il peut voler en arrière !", "Encyclopaedia Britannica, “Hummingbird”"),
      F("Its wings beat so fast that they hum: some hummingbirds beat them more than 50 times a second.", "Ses ailes battent si vite qu'elles bourdonnent : certains colibris les battent plus de 50 fois par seconde.", "Its wings hum.", "Ses ailes bourdonnent.", "Encyclopaedia Britannica, “Hummingbird”"),
      F("It is a bird: 2 legs, 2 wings, feathers and a beak.", "C'est un oiseau : 2 pattes, 2 ailes, des plumes et un bec.", "It is a tiny bird.", "C'est un tout petit oiseau.", "Encyclopaedia Britannica, “Bird”"),
      F("It looks for long, tube-shaped flowers, often red or pink, and reaches the nectar deep inside with its long beak and tongue.", "Il cherche des fleurs longues en forme de tube, souvent rouges ou roses, et atteint le nectar tout au fond avec son long bec et sa langue.", "It drinks from tube flowers.", "Il boit dans les fleurs en tube.", "U.S. Forest Service, “Bird pollination”"),
    ],
    lens: [{ feature: "legs", value: 2 }, { feature: "wings", value: 2 }],
  }),
  pol("pollinator:monarch", {
    id: "monarch", biome: "garden", icon: "🦋", name: L("Monarch butterfly", "Papillon monarque"), group: L("an insect (a butterfly)", "un insecte (un papillon)"), scale: 2.6,
    feed: L("drinking nectar", "boit du nectar"), special: L("resting", "se repose"), stages: [1, 2, 4, 8],
    habitat: L("In the community garden, when the milkweed flowers", "Dans le jardin partagé, quand l'asclépiade fleurit"),
    facts: [
      F("Monarchs from eastern North America fly up to about 4,800 km (3,000 miles) to spend the winter in the mountains of Mexico.", "Les monarques de l'est de l'Amérique du Nord volent jusqu'à environ 4 800 km pour passer l'hiver dans les montagnes du Mexique.", "It flies very far for the winter.", "Il vole très loin pour l'hiver.", "U.S. Forest Service, “Monarch butterfly migration”"),
      F("Its bright orange wings warn birds: it tastes bad, because of the milkweed it ate as a caterpillar.", "Ses ailes orange vif préviennent les oiseaux : il a mauvais goût, à cause de l'asclépiade mangée quand il était chenille.", "Its colours say: do not eat me!", "Ses couleurs disent : ne me mange pas !", "Monarch Joint Venture, “Monarch biology”"),
      F("It is an insect: 4 wings covered in tiny scales, 2 antennae and 6 legs.", "C'est un insecte : 4 ailes couvertes de minuscules écailles, 2 antennes et 6 pattes.", "4 wings, 2 antennae: an insect!", "4 ailes, 2 antennes : un insecte !", "Encyclopaedia Britannica, “Monarch butterfly”"),
      F("A mother monarch “tastes” a leaf with her feet to check it is milkweed before she lays an egg on it.", "Une maman monarque « goûte » une feuille avec ses pattes pour vérifier que c'est de l'asclépiade avant d'y pondre un œuf.", "It tastes with its feet!", "Il goûte avec ses pattes !", "Monarch Joint Venture, “How monarchs find milkweed”"),
    ],
    lens: [{ feature: "wings", value: 4 }, { feature: "antennae", value: 2 }],
  }),
];

// ------------------------------------------------------------------ the props key `together`
const plant = (id: string, icon: string, name: [string, string], visitors: string[], fact: [string, string], source: string) => ({
  id, icon, name: L(name[0], name[1]), modelUrl: A("plant:" + id + ":flowering"), iconUrl: A("plant:" + id + ":flowering:icon"), visitors, fact: L(fact[0], fact[1]), source,
});

/** Every learner-facing word of phase 3 (props `together.ui`, a list of {id, text}; missing ids fall back to these). */
export const TG_UI = {
    garden: L("Community garden", "Jardin partagé"),
    keeperBed: L("The Keeper's bed: always in flower", "Le carré du Gardien : toujours en fleurs"),
    bedHint: L("Everyone in your group plants here. Pick a free spot.", "Tout ton groupe plante ici. Choisis une place libre."),
    plant: L("Plant", "Planter"),
    pickSeed: L("Which seed?", "Quelle graine ?"),
    water: L("Water", "Arroser"),
    watered: L("Watered! It will grow a little faster.", "Arrosée ! Elle poussera un peu plus vite."),
    wateredSoon: L("Already watered. Come back in a little while.", "Déjà arrosée. Reviens un peu plus tard."),
    planted: L("Planted! Watch it grow.", "Planté ! Regarde-la pousser."),
    plantedBy: L("Planted by {name}", "Plantée par {name}"),
    yourPlant: L("Your plant", "Ta plante"),
    sprout: L("Sprout", "Pousse"),
    young: L("Growing", "En croissance"),
    flowering: L("In flower", "En fleurs"),
    plantsLeft: L("You can have {n} plants growing at once.", "Tu peux avoir {n} plantes qui poussent en même temps."),
    replaceOldest: L("Your oldest plant makes room for the new one.", "Ta plus vieille plante laisse la place à la nouvelle."),
    visitors: L("Who comes to it", "Qui vient la voir"),
    noVisitors: L("Next stage in about {n} min", "Prochaine étape dans environ {n} min"),
    chart: L("Who visits what?", "Qui visite quoi ?"),
    chartHint: L("Photograph a pollinator drinking from a garden flower to fill in the chart.", "Photographie un pollinisateur qui boit dans une fleur du jardin pour remplir le tableau."),
    pairFound: L("New in your chart: {who} visits {what}!", "Nouveau dans ton tableau : {who} visite {what} !"),
    museum: L("Explorers' Museum", "Musée des explorateurs"),
    museumHint: L("Walk up to a display to look at it.", "Approche-toi d'une vitrine pour la regarder."),
    display: L("{name}'s photos", "Les photos de {name}"),
    yourDisplay: L("Your display", "Ta vitrine"),
    keeperDisplay: L("The Grove Keeper's photos", "Les photos du Gardien du bosquet"),
    emptyDisplay: L("An empty display, waiting for an explorer.", "Une vitrine vide, qui attend un explorateur."),
    choosePhotos: L("Choose your photos", "Choisis tes photos"),
    chooseHint: L("Tap up to {n} of your best photos.", "Touche jusqu'à {n} de tes meilleures photos."),
    noPhotos: L("Take photos with your Field Camera first.", "Prends d'abord des photos avec ton appareil."),
    onShow: L("On show", "Exposée"),
    leaveSticker: L("Leave a sticker", "Laisse un autocollant"),
    stickerLeft: L("Sticker left! Thank you.", "Autocollant laissé ! Merci."),
    stickersGot: L("Stickers from visitors", "Autocollants des visiteurs"),
    blitz: L("BioBlitz", "BioBlitz"),
    blitzIntro: L("Team up with the explorers here: find {goal} different species together in {min} minutes. Every photo, catch or lens look counts for everyone!", "Fais équipe avec les explorateurs d'ici : trouvez ensemble {goal} espèces différentes en {min} minutes. Chaque photo, capture ou observation à la loupe compte pour tout le monde !"),
    blitzIntroEasy: L("Find {goal} creatures together!", "Trouvez {goal} créatures ensemble !"),
    blitzStart: L("Start a BioBlitz", "Lancer un BioBlitz"),
    blitzJoin: L("Join the BioBlitz", "Rejoindre le BioBlitz"),
    blitzOn: L("A BioBlitz is on! Join it at the banner.", "Un BioBlitz a commencé ! Rejoins-le près de la bannière."),
    blitzCount: L("{n} of {goal} species", "{n} espèces sur {goal}"),
    blitzTeam: L("Team: {n}", "Équipe : {n}"),
    blitzNew: L("New species for the team: {name}!", "Nouvelle espèce pour l'équipe : {name} !"),
    blitzHow: L("Photograph, catch or look closely at creatures anywhere: the Grove, the garden, the Biome Frontier.", "Photographie, attrape ou observe à la loupe des créatures partout : le Bosquet, le jardin, la Frontière des biomes."),
    blitzDone: L("The BioBlitz is over! Your team found {n} species.", "Le BioBlitz est fini ! Ton équipe a trouvé {n} espèces."),
    blitzGoalMet: L("You reached the goal together!", "Vous avez atteint le but ensemble !"),
    blitzThanks: L("Every find counts. Real BioBlitzes are like that too!", "Chaque découverte compte. Les vrais BioBlitz, c'est pareil !"),
    blitzRealFact: L("A real event", "Un vrai événement"),
    teamUp: L("Team-up find", "Découverte en équipe"),
    teamNeed: L("This find needs two explorers working together: {hold} + {act}.", "Cette découverte demande deux explorateurs ensemble : {hold} + {act}."),
    holdIt: L("I hold it", "Je le tiens"),
    stopHold: L("Put it away", "Le ranger"),
    holding: L("You are holding it. Your friend can go!", "Tu le tiens. Ton ami peut y aller !"),
    friendHolding: L("{name} is holding it: go!", "{name} le tient : vas-y !"),
    waitFriend: L("Waiting for a friend…", "On attend un ami…"),
    helperComing: L("The Keeper's helper is here to hold it for you.", "L'assistant du Gardien est là pour le tenir pour toi."),
    needPartner: L("Too quick for one explorer! A friend holding it open helps: {hold}.", "Trop rapide pour un seul explorateur ! Un ami qui le tient ouvert t'aide : {hold}."),
    coopDone: L("Found together!", "Trouvé ensemble !"),
    coopThanks: L("You helped {name}: you found it together!", "Tu as aidé {name} : vous l'avez trouvé ensemble !"),
    showBeginner: L("Show it to {name}", "Le montrer à {name}"),
    shownBy: L("{name} is showing you a {what}. Look for the glow!", "{name} te montre : {what}. Cherche la lueur !"),
    helped: L("You showed {what} to {name}. Thank you, helper!", "Tu as montré {what} à {name}. Merci, l'ami !"),
    badge: L("New badge!", "Nouveau badge !"),
    badges: L("Badges", "Badges"),
    close: L("Close", "Fermer"),
    look: L("Look", "Regarder"),
    source: L("Source: {source}", "Source : {source}"),
};
export type TgUi = Record<keyof typeof TG_UI, LocalizedText>;

const uiCache = new WeakMap<UiLine[], TgUi>();
/** The props' UI lines as a table (cached per list). */
export function tgUi(tp: TogetherProps): TgUi {
  const list = Array.isArray(tp.ui) ? tp.ui : [];
  let m = uiCache.get(list);
  if (!m) {
    m = { ...TG_UI };
    for (const l of list) if (l && typeof l.id === "string" && l.id in m && l.text) (m as Record<string, LocalizedText>)[l.id] = l.text;
    uiCache.set(list, m);
  }
  return m;
}

export const defaultTogether: TogetherProps = {
  ui: Object.keys(TG_UI).map((id) => ({ id, text: (TG_UI as Record<string, LocalizedText>)[id] })),
  rules: { youngMin: 10, flowerMin: 30, waterMin: 3, waterMax: 3, plantsEach: 3, lifeHours: 72, blitzGoal: 15, blitzMinutes: 10, museumEach: 4, helperAfter: 40, newcomerPages: 5 },
  plants: [
    plant("sunflower", "🌻", ["Sunflower", "Tournesol"], ["bumblebee", "honeybee"], ["A sunflower head is made of hundreds of tiny flowers packed together. Each one can become a seed.", "Une tête de tournesol est faite de centaines de petites fleurs serrées. Chacune peut devenir une graine."], "Encyclopaedia Britannica, “Sunflower”"),
    plant("lavender", "💜", ["Lavender", "Lavande"], ["bumblebee", "hoverfly", "honeybee"], ["Lavender's many small purple flowers are full of nectar: bees and hoverflies visit it all summer.", "Les nombreuses petites fleurs violettes de la lavande sont pleines de nectar : abeilles et syrphes la visitent tout l'été."], "Royal Horticultural Society, “Plants for pollinators”"),
    plant("foxglove", "🌸", ["Foxglove", "Digitale"], ["bumblebee", "hummingbird"], ["Foxglove flowers are long tubes. Bumblebees crawl right inside, and hummingbirds reach in with their long beaks. (Never eat it: it is poisonous.)", "Les fleurs de digitale sont de longs tubes. Les bourdons entrent dedans, et les colibris y plongent leur long bec. (Ne la mange jamais : elle est toxique.)"], "U.S. Forest Service, “Bird pollination”; Royal Horticultural Society"),
    plant("clover", "🍀", ["Clover", "Trèfle"], ["bumblebee", "hoverfly", "honeybee"], ["Clover makes the soil richer: tiny bacteria in its roots take nitrogen from the air.", "Le trèfle enrichit la terre : de minuscules bactéries dans ses racines prennent l'azote de l'air."], "Encyclopaedia Britannica, “Clover”"),
    plant("tomato", "🍅", ["Tomato", "Tomate"], ["bumblebee"], ["Tomato flowers give no nectar and hold their pollen tight: only buzzing bees, like bumblebees, can shake it out.", "Les fleurs de tomate ne donnent pas de nectar et gardent leur pollen bien serré : seules les abeilles qui vibrent, comme les bourdons, peuvent le faire tomber."], "Xerces Society; Bay Nature, “Buzz pollination”"),
    plant("milkweed", "🌿", ["Milkweed", "Asclépiade"], ["monarch"], ["Monarch caterpillars eat only milkweed. Adult monarchs drink nectar from many flowers, but they lay their eggs only on milkweed.", "Les chenilles du monarque ne mangent que de l'asclépiade. Les monarques adultes boivent le nectar de beaucoup de fleurs, mais ne pondent que sur l'asclépiade."], "Monarch Joint Venture, “Monarch life cycle”"),
  ],
  keeperBed: ["lavender", "sunflower", "clover", "clover", "sunflower", "lavender"],
  coop: [
    { id: "firefly-lantern", species: "firefly", zone: "biome-frontier", hold: "lantern", act: "camera", fact: L("Firefly watchers cover their light with red film: fireflies flash to find each other, and bright white light gets in the way.", "Les observateurs de lucioles couvrent leur lampe d'un filtre rouge : les lucioles clignotent pour se trouver, et une lumière blanche vive les gêne."), source: "U.S. National Park Service, “Synchronous fireflies”; Xerces Society, “Firefly-friendly lighting”" },
    { id: "hoverfly-jar", species: "hoverfly", zone: "idea-grove", hold: "jar", act: "net", fact: L("A hoverfly can stop still in mid-air and dart off in a flash: with one explorer on the net and one holding the jar open, it goes gently straight in.", "Un syrphe peut s'arrêter net en l'air et filer en un éclair : avec un explorateur au filet et un autre qui tient le bocal ouvert, il y entre doucement d'un coup."), source: "Australian Museum, “Hover flies”" },
  ],
  badges: [
    { id: "blitz", icon: "🍃", node: "badge_leaf", name: L("BioBlitz team", "Équipe BioBlitz"), about: L("Your team reached the BioBlitz goal together.", "Ton équipe a atteint le but du BioBlitz ensemble.") },
    { id: "teamup", icon: "☀️", node: "badge_sun", name: L("Team-up", "En équipe"), about: L("You made a find that needs two explorers.", "Tu as fait une découverte qui demande deux explorateurs.") },
    { id: "gardener", icon: "💧", node: "badge_drop", name: L("Gardener", "Jardinier"), about: L("A plant you planted came into flower.", "Une plante que tu as plantée a fleuri.") },
    { id: "helper", icon: "🌸", node: "badge_flower", name: L("Helper", "Bon guide"), about: L("You showed a creature to a beginner.", "Tu as montré une créature à un débutant.") },
  ],
  stickers: [
    { id: "wow", url: A("sticker:wow"), name: L("Wow!", "Waouh !") },
    { id: "heart-leaf", url: A("sticker:heart-leaf"), name: L("Love it", "J'adore") },
    { id: "star", url: A("sticker:star"), name: L("Star photo", "Photo étoile") },
    { id: "sparkle", url: A("sticker:sparkle"), name: L("Amazing", "Magnifique") },
    { id: "laugh", url: A("sticker:laugh"), name: L("Fun!", "Trop drôle !") },
    { id: "clap", url: A("sticker:clap"), name: L("Well done", "Bravo") },
  ],
  keeperPhotos: [
    { species: "tree-frog", behaviour: "feed", stars: 3 },
    { species: "honeybee", behaviour: "feed", stars: 3 },
    { species: "toucan", behaviour: "idle", stars: 2 },
    { species: "monarch-caterpillar", behaviour: "feed", stars: 2 },
  ],
  blitzFact: L("A BioBlitz is a real event: scientists, families and kids team up to find and record as many living things as they can in one place, in a short time. The first was held in 1996 at Kenilworth Aquatic Gardens in Washington, D.C., and found about 1,000 species.", "Un BioBlitz est un vrai événement : scientifiques, familles et enfants font équipe pour trouver et noter le plus d'êtres vivants possible au même endroit, en peu de temps. Le premier a eu lieu en 1996 aux jardins aquatiques de Kenilworth, à Washington, et a trouvé environ 1 000 espèces."),
  blitzFactEasy: L("Real scientists and families count living things together. It's called a BioBlitz!", "De vrais scientifiques et des familles comptent les êtres vivants ensemble. Ça s'appelle un BioBlitz !"),
  blitzSource: "National Geographic Education, “BioBlitz”; Wikipedia, “BioBlitz”",
  helperName: L("Keeper's helper", "Assistant du Gardien"),
  models: {
    bed: A("garden:bed"),
    bedSoil: A("garden:bed:soil"),
    can: A("garden:watering-can"),
    packets: A("garden:seed-packet:sunflower"),
    museum: A("museum:building"),
    frame: A("museum:frame"),
    plinth: A("museum:plinth"),
    stickerBoard: A("museum:sticker-board"),
    banner: A("bioblitz:banner"),
    totem: A("bioblitz:totem"),
    badges: A("bioblitz:badge:leaf"),
    lantern: A("tool:lantern"),
  },
};
