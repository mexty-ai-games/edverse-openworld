// Default content of the first expedition (EN + FR): the quests, the Grove Keeper's lines, the field kit
// and the 12 Field Guide pages. Every fact is real and carries the source it can be checked in. These are
// the props defaults (the saved variant holds the same content, with the voice-over URLs).
import type { ExpeditionProps, GuideFact, Quest } from "../block";
import { ASSETS } from "../zones/biome-frontier/assets.gen";
import { EXP_ASSETS, EXP_VOICE, P2_ASSETS } from "./assets.gen";
import { insects, phase2Dialogues, phase2LensFeatures, phase2Lines, phase2Quests, phase2Tools, phase2Ui } from "./phase2";

const L = (en: string, fr: string) => ({ en, fr });
const F = (en: string, fr: string, easyEn: string, easyFr: string, source: string): GuideFact => ({ text: L(en, fr), easy: L(easyEn, easyFr), source });

export const defaultQuests: Quest[] = [
  {
    id: "three-sparks",
    icon: "✨",
    title: L("Three sparks", "Trois étincelles"),
    intro: "greet",
    done: "",
    giveAtStart: [],
    reward: ["camera", "guide"],
    steps: [
      { id: "find-sparks", kind: "find", target: "spark", count: 3, zone: "idea-grove", icon: "✨", text: L("Find the glowing seeds {n}/{count}", "Trouve les graines qui brillent {n}/{count}"), line: "sparks" },
      { id: "back-to-keeper", kind: "talk", target: "keeper", count: 1, zone: "idea-grove", icon: "🧓", text: L("Go back to the Grove Keeper", "Retourne voir le Gardien du bosquet"), line: "back", dialogue: "sparksDone" },
    ],
  },
  {
    id: "first-photo",
    icon: "📷",
    title: L("Your first photo", "Ta première photo"),
    intro: "frog",
    done: "firstPhoto",
    giveAtStart: [],
    reward: [],
    steps: [
      { id: "photo-frog", kind: "photo", target: "tree-frog", count: 1, zone: "", icon: "🐸", text: L("Photograph the tree frog on the Biome Frontier stall", "Photographie la rainette sur l'étal de la Frontière des biomes"), line: "frog" },
    ],
  },
  {
    id: "into-the-frontier",
    icon: "🌿",
    title: L("Into the Biome Frontier", "En route pour la Frontière des biomes"),
    intro: "frontier",
    done: "",
    giveAtStart: [],
    reward: [],
    steps: [
      { id: "go-frontier", kind: "visit", target: "biome-frontier", count: 1, zone: "", icon: "🚪", text: L("Walk into the Biome Frontier stall", "Entre dans l'étal de la Frontière des biomes"), line: "frontier" },
      { id: "photo-three", kind: "photo", target: "any", count: 3, zone: "biome-frontier", icon: "📷", text: L("Photograph 3 different creatures {n}/{count}", "Photographie 3 créatures différentes {n}/{count}"), line: "photos3" },
    ],
  },
  {
    id: "look-closer",
    icon: "🔍",
    title: L("Look closer", "Regarde de plus près"),
    intro: "lens",
    done: "allDone",
    giveAtStart: ["lens"],
    reward: [],
    report: true,
    steps: [
      { id: "identify-two", kind: "identify", target: "any", count: 2, zone: "", icon: "🔍", text: L("Look closely at 2 creatures with the lens {n}/{count}", "Observe 2 créatures à la loupe {n}/{count}"), line: "lensStep" },
    ],
  },
  ...phase2Quests,
];

const base: ExpeditionProps = {
  ui: {
    next: L("Next", "Suivant"),
    close: L("Close", "Fermer"),
    listen: L("Listen", "Écouter"),
    talk: L("Talk", "Parler"),
    pickUp: L("Pick up", "Ramasser"),
    sparkName: L("Glowing seed", "Graine lumineuse"),
    sparkFound: L("Seed {n} of {total}!", "Graine {n} sur {total} !"),
    questDone: L("Quest complete!", "Quête terminée !"),
    newTool: L("New tool: {tool}", "Nouvel outil : {tool}"),
    allDone: L("Expedition complete!", "Expédition terminée !"),
    camera: L("Field Camera", "Appareil photo"),
    cameraHint: L("Put a creature in the ring, then press the button.", "Mets une créature dans le cercle, puis appuie sur le bouton."),
    zoom: L("Zoom", "Zoom"),
    shutter: L("Take the photo", "Prendre la photo"),
    noCreature: L("No creature in this photo. Put one in the ring and try again!", "Pas de créature sur cette photo. Mets-en une dans le cercle et réessaie !"),
    tipCentre: L("Tip: put it in the middle of the ring.", "Astuce : mets-la au milieu du cercle."),
    tipCloser: L("Tip: walk a little closer, slowly, or zoom in.", "Astuce : approche-toi doucement, ou zoome."),
    tipFill: L("Tip: it is too big! Step back or zoom out a little.", "Astuce : elle est trop grande ! Recule ou dézoome un peu."),
    tipBehaviour: L("Tip: wait and watch. A photo while it eats or does something special is worth more!", "Astuce : attends et observe. Une photo pendant qu'elle mange ou fait quelque chose de spécial vaut plus !"),
    perfect: L("A perfect photo!", "Une photo parfaite !"),
    starsLabel: L("{n} of 3 stars", "{n} étoiles sur 3"),
    photoBest: L("New best photo!", "Nouvelle meilleure photo !"),
    photoKept: L("Your best photo of it has {n} stars.", "Ta meilleure photo d'elle a {n} étoiles."),
    newPage: L("New in your Field Guide!", "Nouveau dans ton Guide de terrain !"),
    tooShy: L("It ran off! Creatures hide when you rush at them. Walk slowly.", "Elle s'est sauvée ! Les créatures se cachent si tu cours vers elles. Marche doucement."),
    guide: L("Field Guide", "Guide de terrain"),
    guideProgress: L("{n} of {total} facts found", "{n} faits trouvés sur {total}"),
    guideChip: L("Field Guide {n}/{total}", "Guide {n}/{total}"),
    unknown: L("Not found yet", "Pas encore trouvée"),
    stageSeen: L("Seen", "Vue"),
    stagePhoto: L("Photographed", "Photographiée"),
    stageId: L("Identified", "Identifiée"),
    stageBehaviour: L("Behaviour seen", "Comportement observé"),
    lockedSeen: L("Find this creature to start its page.", "Trouve cette créature pour commencer sa page."),
    lockedPhoto: L("Take its photo to learn more.", "Prends-la en photo pour en savoir plus."),
    lockedId: L("Look at it with the hand lens.", "Observe-la avec la loupe."),
    lockedBehaviour: L("Photograph it while it eats or does something special.", "Photographie-la pendant qu'elle mange ou fait quelque chose de spécial."),
    source: L("Source: {source}", "Source : {source}"),
    bestPhoto: L("Best photo", "Meilleure photo"),
    noPhoto: L("No photo yet", "Pas encore de photo"),
    back: L("Back", "Retour"),
    lens: L("Hand lens", "Loupe"),
    lensHint: L("Tap a creature near you to look closely.", "Touche une créature près de toi pour l'observer de près."),
    lensFar: L("Get a little closer to look with the lens.", "Approche-toi un peu pour regarder à la loupe."),
    lensNone: L("No creature near you. Walk up to one, slowly.", "Pas de créature près de toi. Approche-toi doucement d'une créature."),
    lensTitle: L("Look closely", "Regarde de près"),
    lensCompare: L("Look at it, and at the drawing.", "Regarde-la, et regarde le dessin."),
    lensCheck: L("Check", "Vérifier"),
    lensRight: L("Well observed! It is {group}.", "Bien observé ! C'est {group}."),
    lensWrong: L("Not quite. Look again, slowly.", "Pas tout à fait. Regarde encore, doucement."),
    lensCountHint: L("Tap + once for each one you see.", "Touche + une fois pour chacun que tu vois."),
    yes: L("Yes", "Oui"),
    no: L("No", "Non"),
    undo: L("Undo", "Annuler"),
    doingIdle: L("resting", "se repose"),
    doingMove: L("moving", "se déplace"),
    doingHide: L("hiding", "se cache"),
    stationIntro: L(
      "Find and photograph the creatures of the rainforest, the canyon and the coast, and dig for fossils in the canyon.",
      "Trouve et photographie les créatures de la forêt, du canyon et de la côte, et fouille les fossiles dans le canyon.",
    ),
    ...phase2Ui,
  },
  keeper: {
    name: L("Grove Keeper", "Gardien du bosquet"),
    modelUrl: "",
    portraitUrl: "",
    icon: "🧓",
    lines: [
      { id: "greet1", anim: "wave", text: L("Hello, young explorer! I am the Grove Keeper.", "Bonjour, jeune explorateur ! Je suis le Gardien du bosquet.") },
      { id: "greet2", anim: "talk", text: L("Explorers learn by looking closely at living things.", "Les explorateurs apprennent en regardant de près les êtres vivants.") },
      { id: "sparks", anim: "talk", text: L("Find three glowing seeds around the Grove. Drag to look around: one is behind you!", "Trouve trois graines qui brillent dans le bosquet. Fais glisser pour regarder autour : il y en a une derrière toi !") },
      { id: "back", anim: "wave", text: L("You found them all! Come back to me, by the Idea Tree.", "Tu les as toutes trouvées ! Reviens me voir, près de l'Arbre à idées.") },
      { id: "sparksDone1", anim: "talk", text: L("Three sparks! You looked everywhere, like a real explorer.", "Trois étincelles ! Tu as regardé partout, comme un vrai explorateur.") },
      { id: "sparksDone2", anim: "wave", text: L("Here is your Field Camera, and your Field Guide.", "Voici ton appareil photo, et ton Guide de terrain.") },
      { id: "frog", anim: "talk", text: L("Look! A tree frog is sitting on the Biome Frontier stall. Take its photo!", "Regarde ! Une rainette est assise sur l'étal de la Frontière des biomes. Prends-la en photo !") },
      { id: "firstPhoto", anim: "wave", text: L("Your first photo! Its page in your Field Guide is filling in.", "Ta première photo ! Sa page dans ton Guide de terrain se remplit.") },
      { id: "frontier", anim: "talk", text: L("Now walk into the Biome Frontier, through its stall.", "Maintenant, entre dans la Frontière des biomes, par son étal.") },
      { id: "photos3", anim: "talk", text: L("Photograph three different creatures there. Walk slowly, or they hide!", "Photographie trois créatures différentes. Marche doucement, sinon elles se cachent !") },
      { id: "lens", anim: "wave", text: L("Great photos! Here is a hand lens. Tap a creature near you and count what you see.", "Superbes photos ! Voici une loupe. Touche une créature près de toi et compte ce que tu vois.") },
      { id: "lensStep", anim: "talk", text: L("Look closely at two creatures with your hand lens.", "Observe deux créatures de près avec ta loupe.") },
      { id: "allDone", anim: "wave", text: L("Wonderful! You are a real field explorer now. Keep filling your Field Guide!", "Merveilleux ! Tu es un vrai explorateur de terrain. Continue à remplir ton Guide !") },
      { id: "welcomeBack", anim: "wave", text: L("Welcome back, explorer!", "Bon retour, explorateur !") },
      ...phase2Lines,
    ],
    dialogues: [
      { id: "greet", lines: ["greet1", "greet2", "sparks"] },
      { id: "sparksDone", lines: ["sparksDone1", "sparksDone2"] },
      { id: "frog", lines: ["frog"] },
      { id: "firstPhoto", lines: ["firstPhoto"] },
      { id: "frontier", lines: ["frontier"] },
      { id: "lens", lines: ["lens"] },
      { id: "allDone", lines: ["allDone"] },
      ...phase2Dialogues,
    ],
  },
  tools: [
    { id: "camera", icon: "📷", iconUrl: "", modelUrl: "", name: L("Field Camera", "Appareil photo de terrain"), about: L("Photograph creatures. Calm, well-framed photos of creatures doing something are the best.", "Photographie les créatures. Les meilleures photos sont calmes, bien cadrées, et montrent la créature en action.") },
    { id: "guide", icon: "📖", iconUrl: "", modelUrl: "", name: L("Field Guide", "Guide de terrain"), about: L("A page for every creature. Each thing you find out fills it in.", "Une page par créature. Chaque découverte la remplit.") },
    { id: "lens", icon: "🔍", iconUrl: "", modelUrl: "", name: L("Hand lens", "Loupe"), about: L("Look closely and count legs, wings and arms to find out what a creature is.", "Regarde de près et compte les pattes, les ailes et les bras pour savoir ce qu'est une créature.") },
    ...phase2Tools,
  ],
  lensFeatures: [
    { id: "legs", kind: "count", icon: "🦵", max: 10, question: L("How many legs?", "Combien de pattes ?"), tip: L("Count the legs slowly, one by one: look under the body too.", "Compte les pattes doucement, une par une : regarde aussi sous le corps.") },
    { id: "wings", kind: "count", icon: "🪽", max: 6, question: L("How many wings?", "Combien d'ailes ?"), tip: L("Look at both sides: wings come in pairs.", "Regarde des deux côtés : les ailes vont par paires.") },
    { id: "antennae", kind: "count", icon: "📡", max: 4, question: L("How many feelers (antennae) on its head?", "Combien d'antennes sur sa tête ?"), tip: L("Look at the top of its head.", "Regarde le haut de sa tête.") },
    { id: "arms", kind: "count", icon: "💪", max: 10, question: L("How many arms?", "Combien de bras ?"), tip: L("Start from one arm and go round, counting each one.", "Pars d'un bras et fais le tour en les comptant.") },
    { id: "flippers", kind: "count", icon: "🌊", max: 6, question: L("How many flippers?", "Combien de nageoires-palettes ?"), tip: L("Look at the front and at the back of its body.", "Regarde devant et derrière son corps.") },
    { id: "shell", kind: "yesno", icon: "🐚", max: 1, question: L("Does it have a hard shell?", "A-t-elle une carapace dure ?"), tip: L("Look at its back: is it hard and round, or soft?", "Regarde son dos : est-il dur et bombé, ou mou ?") },
    { id: "spines", kind: "yesno", icon: "🌵", max: 1, question: L("Does it have spikes or spines?", "A-t-elle des piquants ?"), tip: L("Look at its edges and its head closely.", "Regarde bien ses bords et sa tête.") },
    { id: "fur", kind: "yesno", icon: "🧶", max: 1, question: L("Does it have fur?", "A-t-elle des poils ?"), tip: L("Is its body covered in soft hair?", "Son corps est-il couvert de poils doux ?") },
    { id: "fins", kind: "yesno", icon: "🐟", max: 1, question: L("Does it have fins?", "A-t-elle des nageoires ?"), tip: L("Look at its back and its tail.", "Regarde son dos et sa queue.") },
    { id: "horns", kind: "yesno", icon: "🐏", max: 1, question: L("Does it have horns?", "A-t-elle des cornes ?"), tip: L("Look at the top of its head.", "Regarde le haut de sa tête.") },
    ...phase2LensFeatures,
  ],
  species: [
    {
      id: "toucan", biome: "rainforest", icon: "🐦", name: L("Toucan", "Toucan"), group: L("a bird", "un oiseau"),
      iconUrl: ASSETS.img_toucan, silhouetteUrl: "", modelUrl: ASSETS.toucan, scale: 1.3,
      feed: L("pecking fruit", "picore un fruit"), special: L("flying", "vole"),
      facts: [
        F("Toucans live in the tropical forests of Central and South America.", "Les toucans vivent dans les forêts tropicales d'Amérique centrale et du Sud.", "It lives in warm, rainy forests.", "Il vit dans les forêts chaudes et pluvieuses.", "Encyclopaedia Britannica, “Toucan”"),
        F("Its huge beak is very light: inside, it is full of tiny air spaces.", "Son énorme bec est très léger : à l'intérieur, il est plein de petits espaces d'air.", "Its big beak is very light.", "Son grand bec est très léger.", "Smithsonian's National Zoo, “Toco toucan”"),
        F("It is a bird: two legs, two wings and feathers. Two toes point forward and two point back, to grip branches.", "C'est un oiseau : deux pattes, deux ailes et des plumes. Deux doigts vont vers l'avant et deux vers l'arrière, pour tenir les branches.", "It is a bird: 2 legs, 2 wings.", "C'est un oiseau : 2 pattes, 2 ailes.", "Smithsonian's National Zoo, “Toco toucan”"),
        F("It picks fruit with the tip of its beak, then tosses its head back to swallow it.", "Il cueille un fruit du bout du bec, puis rejette la tête en arrière pour l'avaler.", "It picks fruit with its beak.", "Il cueille des fruits avec son bec.", "San Diego Zoo Wildlife Alliance, “Toucan”"),
      ],
      lens: [{ feature: "legs", value: 2 }, { feature: "wings", value: 2 }],
    },
    {
      id: "tree-frog", biome: "rainforest", icon: "🐸", name: L("Red-eyed tree frog", "Rainette aux yeux rouges"), group: L("an amphibian", "un amphibien"),
      iconUrl: ASSETS.img_tree_frog, silhouetteUrl: "", modelUrl: ASSETS.tree_frog, scale: 1.6,
      feed: L("catching an insect", "attrape un insecte"), special: L("calling", "coasse"),
      facts: [
        F("Red-eyed tree frogs live in the rainforests of Central America, near ponds and streams.", "Les rainettes aux yeux rouges vivent dans les forêts tropicales d'Amérique centrale, près des mares et des ruisseaux.", "It lives near water in the rainforest.", "Elle vit près de l'eau, dans la forêt tropicale.", "Smithsonian's National Zoo, “Red-eyed tree frog”"),
        F("Its big red eyes can startle a hungry animal, which gives the frog time to jump away.", "Ses grands yeux rouges peuvent surprendre un animal affamé : la grenouille a le temps de sauter loin.", "Its red eyes surprise other animals.", "Ses yeux rouges surprennent les autres animaux.", "Smithsonian's National Zoo, “Red-eyed tree frog”"),
        F("It is an amphibian: four legs, no shell, and moist skin. Sticky toe pads help it climb leaves.", "C'est un amphibien : quatre pattes, pas de carapace et une peau humide. Ses doigts collants l'aident à grimper sur les feuilles.", "It has 4 legs and sticky toes.", "Elle a 4 pattes et des doigts collants.", "Encyclopaedia Britannica, “Tree frog”"),
        F("It sleeps under a leaf in the day and hunts insects such as crickets and moths at night.", "Elle dort sous une feuille le jour et chasse la nuit des insectes comme les grillons et les papillons de nuit.", "It hunts insects at night.", "Elle chasse des insectes la nuit.", "Smithsonian's National Zoo, “Red-eyed tree frog”"),
      ],
      lens: [{ feature: "legs", value: 4 }, { feature: "shell", value: 0 }],
    },
    {
      id: "morpho", biome: "rainforest", icon: "🦋", name: L("Blue morpho butterfly", "Papillon morpho bleu"), group: L("an insect", "un insecte"),
      iconUrl: ASSETS.img_morpho, silhouetteUrl: "", modelUrl: ASSETS.morpho, scale: 1.4,
      feed: L("drinking fruit juice", "boit le jus d'un fruit"), special: L("fluttering", "volette"),
      facts: [
        F("Blue morphos live in the rainforests of Central and South America.", "Les morphos bleus vivent dans les forêts tropicales d'Amérique centrale et du Sud.", "It lives in the rainforest.", "Il vit dans la forêt tropicale.", "Encyclopaedia Britannica, “Morpho”"),
        F("Its wings are not painted blue: tiny scales bounce the light so they shine.", "Ses ailes ne sont pas peintes en bleu : de minuscules écailles renvoient la lumière et les font briller.", "Its wings shine blue in the light.", "Ses ailes brillent en bleu dans la lumière.", "Natural History Museum, London, “Blue morpho”"),
        F("It is an insect: six legs, two antennae and four wings.", "C'est un insecte : six pattes, deux antennes et quatre ailes.", "It is an insect: 4 wings.", "C'est un insecte : 4 ailes.", "Encyclopaedia Britannica, “Insect”"),
        F("It drinks the juice of ripe, fallen fruit through a long, tube-like mouth called a proboscis.", "Il boit le jus des fruits mûrs tombés au sol avec une longue bouche en forme de tube, la trompe.", "It drinks fruit juice with a long tube.", "Il boit le jus des fruits avec un long tube.", "Smithsonian's National Museum of Natural History, “Blue morpho”"),
      ],
      lens: [{ feature: "wings", value: 4 }, { feature: "antennae", value: 2 }],
    },
    {
      id: "sloth", biome: "rainforest", icon: "🦥", name: L("Sloth", "Paresseux"), group: L("a mammal", "un mammifère"),
      iconUrl: "", silhouetteUrl: "", modelUrl: "", scale: 1.0,
      feed: L("chewing leaves", "mâche des feuilles"), special: L("climbing slowly", "grimpe lentement"),
      facts: [
        F("Sloths live high in the rainforest trees of Central and South America.", "Les paresseux vivent en haut des arbres des forêts tropicales d'Amérique centrale et du Sud.", "It lives high up in the trees.", "Il vit en haut des arbres.", "Smithsonian's National Zoo, “Two-toed sloth”"),
        F("Tiny green algae grow in its fur, which helps it hide among the leaves.", "De minuscules algues vertes poussent dans sa fourrure, ce qui l'aide à se cacher dans les feuilles.", "Its fur can turn a little green.", "Sa fourrure peut devenir un peu verte.", "Encyclopaedia Britannica, “Sloth”"),
        F("It is a mammal: it has fur, and four limbs with long curved claws for hanging from branches.", "C'est un mammifère : il a des poils, et quatre membres avec de longues griffes courbes pour se suspendre aux branches.", "It has fur and 4 legs with claws.", "Il a des poils et 4 pattes à griffes.", "Encyclopaedia Britannica, “Sloth”"),
        F("It eats leaves and moves very slowly to save energy. It comes down from its tree only about once a week, to go to the toilet!", "Il mange des feuilles et bouge très lentement pour économiser son énergie. Il ne descend de son arbre qu'environ une fois par semaine, pour aller aux toilettes !", "It eats leaves and moves slowly.", "Il mange des feuilles et bouge lentement.", "Smithsonian's National Zoo, “Two-toed sloth”"),
      ],
      lens: [{ feature: "legs", value: 4 }, { feature: "fur", value: 1 }],
    },
    {
      id: "tortoise", biome: "canyon", icon: "🐢", name: L("Desert tortoise", "Tortue du désert"), group: L("a reptile", "un reptile"),
      iconUrl: ASSETS.img_tortoise, silhouetteUrl: "", modelUrl: ASSETS.tortoise, scale: 1.5,
      feed: L("eating plants", "mange des plantes"), special: L("resting in its shell", "se repose dans sa carapace"),
      facts: [
        F("Desert tortoises live in the deserts of the south-western United States and Mexico.", "Les tortues du désert vivent dans les déserts du sud-ouest des États-Unis et du Mexique.", "It lives in hot deserts.", "Elle vit dans les déserts chauds.", "U.S. National Park Service, “Desert tortoise”"),
        F("Its domed shell is part of its skeleton: a tortoise can never climb out of it.", "Sa carapace bombée fait partie de son squelette : une tortue ne peut jamais en sortir.", "Its shell is part of its body.", "Sa carapace fait partie de son corps.", "Encyclopaedia Britannica, “Turtle”"),
        F("It is a reptile: four sturdy legs, scaly skin and a hard shell.", "C'est un reptile : quatre pattes solides, une peau à écailles et une carapace dure.", "It has 4 legs and a shell.", "Elle a 4 pattes et une carapace.", "Encyclopaedia Britannica, “Reptile”"),
        F("It eats grasses, flowers and cactus, and gets much of its water from these plants.", "Elle mange des herbes, des fleurs et des cactus, et trouve une grande partie de son eau dans ces plantes.", "It eats plants and flowers.", "Elle mange des plantes et des fleurs.", "U.S. National Park Service, “Desert tortoise”"),
      ],
      lens: [{ feature: "legs", value: 4 }, { feature: "shell", value: 1 }],
    },
    {
      id: "horned-lizard", biome: "canyon", icon: "🦎", name: L("Horned lizard", "Lézard cornu"), group: L("a reptile", "un reptile"),
      iconUrl: ASSETS.img_horned_lizard, silhouetteUrl: "", modelUrl: ASSETS.horned_lizard, scale: 1.6,
      feed: L("catching ants", "attrape des fourmis"), special: L("basking in the sun", "se chauffe au soleil"),
      facts: [
        F("Horned lizards live in dry, sandy and rocky places of North America.", "Les lézards cornus vivent dans les endroits secs, sableux et rocheux d'Amérique du Nord.", "It lives in dry, sandy places.", "Il vit dans les endroits secs et sableux.", "U.S. National Park Service, “Horned lizards”"),
        F("Its flat, spiky, sand-coloured body is camouflage: lying still, it looks like the ground.", "Son corps plat, piquant et couleur sable est un camouflage : immobile, il ressemble au sol.", "Its sandy colours help it hide.", "Ses couleurs de sable l'aident à se cacher.", "U.S. National Park Service, “Horned lizards”"),
        F("It is a reptile: four legs, scaly skin and spiky horns on its head.", "C'est un reptile : quatre pattes, une peau à écailles et des cornes piquantes sur la tête.", "It has 4 legs and spikes.", "Il a 4 pattes et des piquants.", "Encyclopaedia Britannica, “Horned lizard”"),
        F("In the morning it lies in the sun to warm up: reptiles take their heat from the world around them.", "Le matin, il se couche au soleil pour se réchauffer : les reptiles prennent leur chaleur autour d'eux.", "It warms up in the sun.", "Il se réchauffe au soleil.", "Encyclopaedia Britannica, “Reptile”"),
      ],
      lens: [{ feature: "legs", value: 4 }, { feature: "spines", value: 1 }],
    },
    {
      id: "bighorn", biome: "canyon", icon: "🐏", name: L("Desert bighorn sheep", "Mouflon du désert"), group: L("a mammal", "un mammifère"),
      iconUrl: "", silhouetteUrl: "", modelUrl: "", scale: 1.0,
      feed: L("grazing", "broute"), special: L("climbing the rocks", "grimpe sur les rochers"),
      facts: [
        F("Desert bighorn sheep live on steep, rocky mountains and canyons of the south-western United States and Mexico.", "Les mouflons du désert vivent sur les montagnes et les canyons rocheux et raides du sud-ouest des États-Unis et du Mexique.", "It lives on steep, rocky cliffs.", "Il vit sur des falaises de roche.", "U.S. National Park Service, “Desert bighorn sheep”"),
        F("A ram's big curled horns can weigh more than all the other bones in its body.", "Les grandes cornes enroulées d'un bélier peuvent peser plus que tous les autres os de son corps.", "Its horns are very heavy.", "Ses cornes sont très lourdes.", "U.S. National Park Service, “Desert bighorn sheep”"),
        F("It is a mammal: four legs and split hooves with a hard edge and a soft, grippy middle for climbing.", "C'est un mammifère : quatre pattes et des sabots fendus, au bord dur et au centre souple qui accroche pour grimper.", "It has 4 legs and grippy hooves.", "Il a 4 pattes et des sabots qui accrochent.", "U.S. National Park Service, “Desert bighorn sheep”"),
        F("It grazes on grasses and shrubs, and can go a long time without drinking water.", "Il broute des herbes et des arbustes, et peut rester longtemps sans boire.", "It eats grass and shrubs.", "Il mange de l'herbe et des arbustes.", "U.S. National Park Service, “Desert bighorn sheep”"),
      ],
      lens: [{ feature: "legs", value: 4 }, { feature: "horns", value: 1 }],
    },
    {
      id: "saguaro", biome: "canyon", icon: "🌵", name: L("Saguaro cactus", "Cactus saguaro"), group: L("a plant", "une plante"),
      iconUrl: ASSETS.img_saguaro, silhouetteUrl: "", modelUrl: ASSETS.saguaro, scale: 1.0,
      feed: L("", ""), special: L("in flower", "en fleurs"),
      facts: [
        F("Saguaros grow only in the Sonoran Desert, in Arizona and in Mexico.", "Les saguaros ne poussent que dans le désert de Sonora, en Arizona et au Mexique.", "It grows in a hot desert.", "Il pousse dans un désert chaud.", "U.S. National Park Service, Saguaro National Park"),
        F("A saguaro can grow taller than a house. Its first arm may take 50 to 70 years to appear.", "Un saguaro peut devenir plus haut qu'une maison. Son premier bras met parfois 50 à 70 ans à pousser.", "It grows taller than a house.", "Il devient plus haut qu'une maison.", "U.S. National Park Service, Saguaro National Park"),
        F("It is a plant, not an animal: no legs at all, but sharp spines that shade and protect it.", "C'est une plante, pas un animal : pas de pattes du tout, mais des épines pointues qui lui font de l'ombre et le protègent.", "It is a plant with spines.", "C'est une plante avec des épines.", "U.S. National Park Service, Saguaro National Park"),
        F("Its white flowers open at night and stay open into the next day. Bats, birds and bees visit them.", "Ses fleurs blanches s'ouvrent la nuit et restent ouvertes le lendemain. Les chauves-souris, les oiseaux et les abeilles les visitent.", "Its white flowers feed bats and bees.", "Ses fleurs blanches nourrissent chauves-souris et abeilles.", "U.S. National Park Service, Saguaro National Park"),
      ],
      lens: [{ feature: "legs", value: 0 }, { feature: "spines", value: 1 }],
    },
    {
      id: "sea-turtle", biome: "coast", icon: "🐢", name: L("Green sea turtle", "Tortue verte"), group: L("a reptile", "un reptile"),
      iconUrl: ASSETS.img_sea_turtle, silhouetteUrl: "", modelUrl: ASSETS.sea_turtle, scale: 1.5,
      feed: L("eating seagrass", "mange des herbes marines"), special: L("coming up to breathe", "remonte respirer"),
      facts: [
        F("Green sea turtles swim in warm oceans all around the world.", "Les tortues vertes nagent dans les océans chauds du monde entier.", "It swims in warm seas.", "Elle nage dans les mers chaudes.", "NOAA Fisheries, “Green turtle”"),
        F("It is named after the green colour of the fat under its shell, not the shell itself.", "Elle doit son nom à la couleur verte de sa graisse, sous sa carapace, pas à la carapace.", "Its name comes from its green fat.", "Son nom vient de sa graisse verte.", "NOAA Fisheries, “Green turtle”"),
        F("It is a reptile: a hard shell, and four flippers instead of feet.", "C'est un reptile : une carapace dure, et quatre nageoires-palettes à la place des pattes.", "It has a shell and 4 flippers.", "Elle a une carapace et 4 nageoires.", "NOAA Fisheries, “Green turtle”"),
        F("Adults eat seagrass and algae, and they swim up to the surface to breathe air.", "Les adultes mangent des herbes marines et des algues, et remontent à la surface pour respirer de l'air.", "It eats seagrass and breathes air.", "Elle mange des herbes marines et respire de l'air.", "NOAA Fisheries, “Green turtle”"),
      ],
      lens: [{ feature: "flippers", value: 4 }, { feature: "shell", value: 1 }],
    },
    {
      id: "clownfish", biome: "coast", icon: "🐠", name: L("Clownfish", "Poisson-clown"), group: L("a fish", "un poisson"),
      iconUrl: ASSETS.img_clownfish, silhouetteUrl: "", modelUrl: ASSETS.clownfish, scale: 1.8,
      feed: L("nibbling food", "grignote sa nourriture"), special: L("hiding in its anemone", "se cache dans son anémone"),
      facts: [
        F("Clownfish live on coral reefs in the warm Indian and Pacific Oceans.", "Les poissons-clowns vivent sur les récifs de corail des océans Indien et Pacifique, où l'eau est chaude.", "It lives on warm coral reefs.", "Il vit sur les récifs de corail chauds.", "Australian Museum, “Clown anemonefish”"),
        F("Many clownfish are orange with three white bands, edged in black.", "Beaucoup de poissons-clowns sont orange avec trois bandes blanches bordées de noir.", "It is orange with white stripes.", "Il est orange avec des bandes blanches.", "Australian Museum, “Clown anemonefish”"),
        F("It is a fish: no legs, it swims with its fins and breathes with gills.", "C'est un poisson : pas de pattes, il nage avec ses nageoires et respire avec des branchies.", "It is a fish: it swims with fins.", "C'est un poisson : il nage avec des nageoires.", "Encyclopaedia Britannica, “Fish”"),
        F("It lives among the stinging arms of a sea anemone. A slimy coat keeps it from being stung.", "Il vit entre les bras piquants d'une anémone de mer. Une couche de mucus le protège des piqûres.", "It hides in a sea anemone.", "Il se cache dans une anémone de mer.", "Australian Museum, “Clown anemonefish”"),
      ],
      lens: [{ feature: "legs", value: 0 }, { feature: "fins", value: 1 }],
    },
    {
      id: "sea-star", biome: "coast", icon: "⭐", name: L("Sea star", "Étoile de mer"), group: L("an echinoderm, a cousin of sea urchins", "un échinoderme, cousin des oursins"),
      iconUrl: ASSETS.img_sea_star, silhouetteUrl: "", modelUrl: ASSETS.sea_star, scale: 1.4,
      feed: L("eating a mussel", "mange une moule"), special: L("", ""),
      facts: [
        F("Sea stars live in every ocean of the world, from rocky shores to the deep sea.", "Les étoiles de mer vivent dans tous les océans du monde, des rochers du rivage aux grandes profondeurs.", "It lives in the sea, on rocks.", "Elle vit dans la mer, sur les rochers.", "NOAA Ocean Service, “Sea stars”"),
        F("Most sea stars have five arms, with a tiny eye spot at the tip of each arm.", "La plupart des étoiles de mer ont cinq bras, avec un petit œil au bout de chaque bras.", "It has an eye at the end of each arm.", "Elle a un œil au bout de chaque bras.", "NOAA Ocean Service, “Sea stars”"),
        F("It is not a fish! It has no bones and moves on hundreds of tiny tube feet.", "Ce n'est pas un poisson ! Elle n'a pas d'os et avance sur des centaines de petits pieds en tube.", "It walks on tiny tube feet.", "Elle marche sur de petits pieds en tube.", "NOAA Ocean Service, “Sea stars”"),
        F("It eats mussels and clams: it pulls their shells open with its tube feet.", "Elle mange des moules et des palourdes : elle ouvre leur coquille en tirant avec ses pieds en tube.", "It opens shells to eat mussels.", "Elle ouvre des coquillages pour manger.", "Encyclopaedia Britannica, “Sea star”"),
      ],
      lens: [{ feature: "arms", value: 5 }, { feature: "legs", value: 0 }],
    },
    {
      id: "octopus", biome: "coast", icon: "🐙", name: L("Octopus", "Pieuvre"), group: L("a mollusc", "un mollusque"),
      iconUrl: "", silhouetteUrl: "", modelUrl: "", scale: 1.0,
      feed: L("peeking out of its den", "sort de sa cachette"), special: L("changing colour", "change de couleur"),
      facts: [
        F("Octopuses live in every ocean. Many hide in dens among rocks and coral.", "Les pieuvres vivent dans tous les océans. Beaucoup se cachent dans des abris entre les rochers et le corail.", "It hides among rocks in the sea.", "Elle se cache entre les rochers, dans la mer.", "Smithsonian Ocean, “Octopus”"),
        F("It has three hearts and blue blood.", "Elle a trois cœurs et du sang bleu.", "It has 3 hearts!", "Elle a 3 cœurs !", "Smithsonian Ocean, “Octopus”"),
        F("It is a mollusc, like snails: eight arms covered in suckers, and no bones.", "C'est un mollusque, comme les escargots : huit bras couverts de ventouses, et pas d'os.", "It has 8 arms with suckers.", "Elle a 8 bras avec des ventouses.", "Encyclopaedia Britannica, “Octopus”"),
        F("It can change colour in less than a second, to hide or to show how it feels.", "Elle peut changer de couleur en moins d'une seconde, pour se cacher ou montrer ce qu'elle ressent.", "It can change colour to hide.", "Elle change de couleur pour se cacher.", "Smithsonian Ocean, “Octopus”"),
      ],
      lens: [{ feature: "arms", value: 8 }, { feature: "shell", value: 0 }],
    },
    ...insects,
  ],
  models: { spark: "", milkweed: P2_ASSETS["plant:milkweed"] || "", lavender: P2_ASSETS["plant:lavender"] || "" },
  sounds: { shutter: "" },
};

/** The expedition's own assets (models, pictures, voice-overs), filled in from the generated URL tables. */
function withAssets(e: ExpeditionProps): ExpeditionProps {
  const A = EXP_ASSETS;
  const V = (id: string) => (EXP_VOICE[id + "-en"] && EXP_VOICE[id + "-fr"] ? { en: EXP_VOICE[id + "-en"], fr: EXP_VOICE[id + "-fr"] } : undefined);
  const prop: Record<string, string> = { camera: "field_camera", guide: "field_guide", lens: "hand_lens" };
  return {
    ...e,
    keeper: {
      ...e.keeper,
      modelUrl: A.keeper || e.keeper.modelUrl,
      portraitUrl: A["keeper:icon"] || e.keeper.portraitUrl,
      lines: e.keeper.lines.map((l) => {
        const audio = V("ow-voice-keeper-" + l.id);
        return audio ? { ...l, audio } : l;
      }),
    },
    tools: e.tools.map((t) => ({ ...t, iconUrl: A["icon:" + t.id] || t.iconUrl, modelUrl: A["prop:" + prop[t.id]] || t.modelUrl })),
    species: e.species.map((s) => {
      const k = "species:" + s.id.replace(/-/g, "_");
      const factAudio = V("ow-voice-fact-" + s.id);
      const out = { ...s, modelUrl: A[k] || s.modelUrl, iconUrl: A[k + ":icon"] || s.iconUrl, silhouetteUrl: A[k + ":silhouette"] || s.silhouetteUrl };
      return factAudio ? { ...out, factAudio } : out;
    }),
    models: { ...e.models, spark: A["prop:spark"] || e.models.spark },
  };
}

export const defaultExpedition: ExpeditionProps = withAssets(base);
