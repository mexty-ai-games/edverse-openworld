// Default content of the Biome Frontier (EN + FR) and its asset URLs. Facts are real and checkable
// (sources noted per fact in docs-style comments); everything here is a prop the store can override.
import type { BiomeFrontierProps } from "./types";
import { ASSETS } from "./assets.gen";

const L = (en: string, fr: string) => ({ en, fr });

export const defaultProps: BiomeFrontierProps = {
  ui: {
    title: L("Biome Frontier", "La Frontière des biomes"),
    surveyChip: L("Field cards {n}/{total}", "Fiches {n}/{total}"),
    digChip: L("Fossil dig", "Fouille"),
    findCards: L(
      "The wind blew the explorers' field cards all over the frontier! Find the glowing cards and put each one back in the right biome.",
      "Le vent a dispersé les fiches des explorateurs partout ! Trouve les fiches qui brillent et range chacune dans le bon biome.",
    ),
    cardTitle: L("Field card", "Fiche d'exploration"),
    whereLives: L("Where does it live?", "Quel est son milieu de vie ?"),
    whereLivesEasy: L("Where is its home?", "Où est sa maison ?"),
    rightBiome: L("Yes! It lives in the {biome}.", "Oui ! Sa maison : {biome}."),
    tryAgain: L("Good try! {hint}", "Bien essayé ! {hint}"),
    showMe: L("Show me", "Montre-moi"),
    next: L("Next", "Suivant"),
    close: L("Close", "Fermer"),
    digTitle: L("Fossil dig", "Fouille de fossiles"),
    digIntro: L(
      "This rock face has 4 layers. Each one hides a fossil.",
      "Cette paroi a 4 couches de roche. Chacune cache un fossile.",
    ),
    digOldest: L("Which layer is the oldest? Tap it.", "Quelle couche est la plus ancienne ? Touche-la."),
    digOldestEasy: L("Which layer was made first? Tap it.", "Quelle couche est arrivée en premier ? Touche-la."),
    digOldestRight: L("Yes! The deepest layer is the oldest: it was there first.", "Oui ! La couche la plus profonde est la plus ancienne : elle était là en premier."),
    digOldestWrong: L(
      "Not quite. New layers settle on top of old ones, like a pile of blankets. Which one is at the very bottom?",
      "Pas tout à fait. Les nouvelles couches se posent sur les anciennes, comme une pile de couvertures. Laquelle est tout en bas ?",
    ),
    digOrder: L("Now tap the fossils from the oldest to the youngest.", "Touche maintenant les fossiles, du plus ancien au plus récent."),
    digOrderWrong: L("Almost! Start again from the bottom layer and go up.", "Presque ! Recommence par la couche du bas, puis monte."),
    digOrderRight: L("Perfect order! You read the rock like a geologist.", "Ordre parfait ! Tu lis la roche comme un géologue."),
    digDone: L("Dig finished!", "Fouille terminée !"),
    layerLabel: L("Layer {n}", "Couche {n}"),
    stationTitle: L("Field station", "Station de terrain"),
    stationIntro: L(
      "Find the glowing field cards around the rainforest, the canyon and the coast, then dig for fossils in the canyon.",
      "Trouve les fiches qui brillent dans la forêt, le canyon et la côte, puis fouille les fossiles dans le canyon.",
    ),
    stationProgress: L("{n} of {total} done", "{n} sur {total} faits"),
    roundDone: L("Survey complete! Great field work, explorer.", "Exploration terminée ! Beau travail de terrain, explorateur."),
    roundScore: L("{n} of {total} right on the first try", "{n} sur {total} justes du premier coup"),
    playAgain: L("New survey", "Nouvelle exploration"),
    easyMode: L("Pictures", "Images"),
    explorerMode: L("Explorer", "Explorateur"),
    modeLabel: L("Mode", "Mode"),
    backToGrove: L("Back to the Idea Grove", "Retour au Bosquet des idées"),
    look: L("Look", "Regarder"),
    notFoundYet: L("Not found yet", "Pas encore trouvée"),
    digWaiting: L("Waiting in the canyon", "T'attend dans le canyon"),
  },
  biomes: [
    {
      id: "rainforest",
      name: L("rainforest", "la forêt tropicale"),
      icon: "🌿",
      color: "#3f9a4c",
      about: L(
        "A tropical rainforest is warm and wet: it rains on most days. Trees grow very tall to reach the light, and many plants have giant leaves.",
        "La forêt tropicale est chaude et humide : il pleut presque tous les jours. Les arbres poussent très haut vers la lumière, et beaucoup de plantes ont des feuilles géantes.",
      ),
    },
    {
      id: "canyon",
      name: L("desert canyon", "le canyon du désert"),
      icon: "🏜️",
      color: "#c8643a",
      about: L(
        "A canyon is a deep valley that a river carved into the rock over millions of years. This one is dry and sunny, so its plants and animals save every drop of water.",
        "Un canyon est une vallée profonde creusée dans la roche par une rivière pendant des millions d'années. Celui-ci est sec et ensoleillé : ses plantes et ses animaux gardent chaque goutte d'eau.",
      ),
    },
    {
      id: "coast",
      name: L("coral coast", "la côte de corail"),
      icon: "🐠",
      color: "#2a9fb8",
      about: L(
        "Coral reefs grow in warm, clear, shallow sea water. Corals are tiny animals that build rocky homes, and lots of fish live among them.",
        "Les récifs de corail poussent dans une mer chaude, claire et peu profonde. Les coraux sont de tout petits animaux qui construisent des maisons de roche, où vivent beaucoup de poissons.",
      ),
    },
  ],
  roundSize: 8,
  species: [
    // ---- rainforest
    {
      id: "toucan", biome: "rainforest", icon: "🐦", imageUrl: ASSETS.img_toucan,
      name: L("Toucan", "Toucan"),
      fact: L(
        "A toucan's huge beak is light: inside it is full of tiny air spaces. The beak also helps the bird cool down on hot days.",
        "L'énorme bec du toucan est léger : à l'intérieur, il est plein de petits espaces d'air. Le bec l'aide aussi à se rafraîchir quand il fait chaud.",
      ),
      factEasy: L("Its big beak is very light. It helps it pick fruit.", "Son grand bec est très léger. Il l'aide à cueillir des fruits."),
      hint: L("It eats fruit high up in tall, rainy trees.", "Il mange des fruits tout en haut de grands arbres sous la pluie."),
    },
    {
      id: "tree-frog", biome: "rainforest", icon: "🐸", imageUrl: ASSETS.img_tree_frog,
      name: L("Red-eyed tree frog", "Rainette aux yeux rouges"),
      fact: L(
        "In the day it sleeps under a leaf, with its eyes closed and its legs tucked in, so its bright colours are hidden.",
        "Le jour, elle dort sous une feuille, les yeux fermés et les pattes repliées : ainsi ses couleurs vives sont cachées.",
      ),
      factEasy: L("It sleeps under a leaf in the day.", "Elle dort sous une feuille pendant le jour."),
      hint: L("It needs damp, leafy places where it rains a lot.", "Il lui faut des endroits humides, pleins de feuilles, où il pleut beaucoup."),
    },
    {
      id: "morpho", biome: "rainforest", icon: "🦋", imageUrl: ASSETS.img_morpho,
      name: L("Blue morpho butterfly", "Papillon morpho bleu"),
      fact: L(
        "Its wings are not painted blue: tiny scales on them bounce the light so that they shine blue.",
        "Ses ailes ne sont pas peintes en bleu : de minuscules écailles renvoient la lumière et les font briller en bleu.",
      ),
      factEasy: L("Its wings shine bright blue.", "Ses ailes brillent en bleu."),
      hint: L("It flutters between giant leaves in warm, wet forests.", "Il volette entre les feuilles géantes des forêts chaudes et humides."),
    },
    {
      id: "sloth", biome: "rainforest", icon: "🦥", imageUrl: "",
      name: L("Sloth", "Paresseux"),
      fact: L(
        "Sloths move so slowly that tiny green algae grow in their fur. The green helps them hide in the trees.",
        "Le paresseux bouge si lentement que de minuscules algues vertes poussent dans sa fourrure. Ce vert l'aide à se cacher dans les arbres.",
      ),
      factEasy: L("It hangs in the trees and moves very slowly.", "Il est suspendu aux arbres et bouge très lentement."),
      hint: L("It spends almost all its life hanging in tall trees.", "Il passe presque toute sa vie suspendu dans de grands arbres."),
    },
    // ---- desert canyon
    {
      id: "tortoise", biome: "canyon", icon: "🐢", imageUrl: ASSETS.img_tortoise,
      name: L("Desert tortoise", "Tortue du désert"),
      fact: L(
        "It digs burrows to hide from the hot sun, and it gets much of the water it needs from the plants it eats.",
        "Elle creuse des terriers pour se cacher du soleil brûlant, et elle trouve une grande partie de son eau dans les plantes qu'elle mange.",
      ),
      factEasy: L("It digs a hole to hide from the hot sun.", "Elle creuse un trou pour se cacher du soleil."),
      hint: L("Its home is hot and dry, with very little rain.", "Sa maison est chaude et sèche, avec très peu de pluie."),
    },
    {
      id: "saguaro", biome: "canyon", icon: "🌵", imageUrl: ASSETS.img_saguaro,
      name: L("Saguaro cactus", "Cactus saguaro"),
      fact: L(
        "After rain, a saguaro's pleated stem swells like an accordion to store water for the dry months.",
        "Après la pluie, la tige plissée du saguaro gonfle comme un accordéon pour garder de l'eau pendant les mois secs.",
      ),
      factEasy: L("A cactus keeps water inside for later.", "Un cactus garde de l'eau à l'intérieur pour plus tard."),
      hint: L("It grows where it hardly ever rains.", "Il pousse là où il ne pleut presque jamais."),
    },
    {
      id: "horned-lizard", biome: "canyon", icon: "🦎", imageUrl: ASSETS.img_horned_lizard,
      name: L("Horned lizard", "Lézard cornu"),
      fact: L(
        "Its flat, spiky, sandy-coloured body is camouflage: lying still, it looks just like the dry ground.",
        "Son corps plat, piquant et couleur sable est un camouflage : immobile, il ressemble au sol sec.",
      ),
      factEasy: L("Its sandy colours help it hide.", "Ses couleurs de sable l'aident à se cacher."),
      hint: L("Look at its colours: they match dry, sandy ground.", "Regarde ses couleurs : elles ressemblent au sol sec et sableux."),
    },
    {
      id: "bighorn", biome: "canyon", icon: "🐏", imageUrl: "",
      name: L("Desert bighorn sheep", "Mouflon du désert"),
      fact: L(
        "Its hooves have a hard edge and a soft, grippy middle, so it can climb steep canyon cliffs.",
        "Ses sabots ont un bord dur et un centre souple qui accroche : il peut grimper sur les falaises raides des canyons.",
      ),
      factEasy: L("It climbs steep rocky cliffs.", "Il grimpe sur des falaises de roche."),
      hint: L("It loves steep, rocky, dry cliffs.", "Il adore les falaises de roche, raides et sèches."),
    },
    // ---- coral coast
    {
      id: "sea-turtle", biome: "coast", icon: "🐢", imageUrl: ASSETS.img_sea_turtle,
      name: L("Green sea turtle", "Tortue verte"),
      fact: L(
        "Mother sea turtles swim back to the beaches where they hatched to lay their own eggs in the sand.",
        "Les mamans tortues reviennent sur les plages où elles sont nées pour pondre leurs œufs dans le sable.",
      ),
      factEasy: L("It swims in the sea and lays eggs on the beach.", "Elle nage dans la mer et pond sur la plage."),
      hint: L("It has flippers for swimming, not feet for walking.", "Elle a des nageoires pour nager, pas des pattes pour marcher."),
    },
    {
      id: "clownfish", biome: "coast", icon: "🐠", imageUrl: ASSETS.img_clownfish,
      name: L("Clownfish", "Poisson-clown"),
      fact: L(
        "Clownfish live among the stinging arms of a sea anemone. A slimy coat keeps them from being stung.",
        "Le poisson-clown vit entre les bras piquants d'une anémone de mer. Une couche de mucus le protège des piqûres.",
      ),
      factEasy: L("It hides in a sea anemone.", "Il se cache dans une anémone de mer."),
      hint: L("It is a fish: it needs warm sea water around the reef.", "C'est un poisson : il lui faut l'eau de mer chaude du récif."),
    },
    {
      id: "sea-star", biome: "coast", icon: "⭐", imageUrl: ASSETS.img_sea_star,
      name: L("Sea star", "Étoile de mer"),
      fact: L("A sea star has no brain, but it can grow back an arm it has lost.", "L'étoile de mer n'a pas de cerveau, mais elle peut faire repousser un bras perdu."),
      factEasy: L("It can grow a new arm.", "Elle peut faire repousser un bras."),
      hint: L("It lives in the sea, on rocks and sand by the shore.", "Elle vit dans la mer, sur les rochers et le sable près du rivage."),
    },
    {
      id: "octopus", biome: "coast", icon: "🐙", imageUrl: "",
      name: L("Octopus", "Pieuvre"),
      fact: L("An octopus has three hearts and can change its colour in a blink to hide on the reef.", "La pieuvre a trois cœurs et peut changer de couleur en un clin d'œil pour se cacher sur le récif."),
      factEasy: L("It has 8 arms and lives in the sea.", "Elle a 8 bras et vit dans la mer."),
      hint: L("It has 8 arms for swimming and hiding in the sea.", "Elle a 8 bras pour nager et se cacher dans la mer."),
    },
  ],
  fossils: [
    { id: "trilobite", layer: 0, icon: "🦴", name: L("Trilobite", "Trilobite"), age: L("about 500 million years old", "environ 500 millions d'années") },
    { id: "fern", layer: 1, icon: "🌿", name: L("Fern leaf", "Feuille de fougère"), age: L("about 300 million years old", "environ 300 millions d'années") },
    { id: "ammonite", layer: 2, icon: "🐚", name: L("Ammonite", "Ammonite"), age: L("about 150 million years old", "environ 150 millions d'années") },
    { id: "shark-tooth", layer: 3, icon: "🦈", name: L("Shark tooth", "Dent de requin"), age: L("about 10 million years old", "environ 10 millions d'années") },
  ],
  layersFact: L(
    "Sand and mud settle in layers, one on top of another, over a very long time. So the deepest layer was made first: it is the oldest. Trilobites and ammonites lived in the sea, so this canyon was under the sea long ago!",
    "Le sable et la boue se déposent en couches, les unes sur les autres, pendant très longtemps. La couche la plus profonde s'est donc formée en premier : c'est la plus ancienne. Les trilobites et les ammonites vivaient dans la mer : ce canyon était sous la mer il y a très longtemps !",
  ),
  layersFactEasy: L("New layers go on top. The bottom layer is the oldest!", "Les nouvelles couches vont dessus. La couche du bas est la plus ancienne !"),
  models: {
    jungleTree: ASSETS.jungle_tree,
    palm: ASSETS.palm,
    giantLeaves: ASSETS.giant_leaf_plants,
    waterfallCliff: ASSETS.waterfall_cliff,
    canyonRocks: ASSETS.canyon_rocks,
    digSite: ASSETS.dig_site,
    corals: ASSETS.corals,
    pier: ASSETS.pier,
    fieldStation: ASSETS.field_station,
    ropeBridge: ASSETS.rope_bridge,
    signposts: ASSETS.signposts,
    trailGate: ASSETS.trail_gate,
    toucan: ASSETS.toucan,
    treeFrog: ASSETS.tree_frog,
    morpho: ASSETS.morpho,
    tortoise: ASSETS.tortoise,
    hornedLizard: ASSETS.horned_lizard,
    saguaro: ASSETS.saguaro,
    seaTurtle: ASSETS.sea_turtle,
    clownfish: ASSETS.clownfish,
    seaStar: ASSETS.sea_star,
    // the Idea Grove's own OpenWorld foliage (ow-grove-fern, ow-grove-grass-tuft)
    fern: "https://future-api.mexty.ai/api/files/p/6adc9142f7668f50f9400831",
    grassTuft: "https://future-api.mexty.ai/api/files/p/6adc9156f7668f50f9400855",
  },
  textures: {
    jungleFloor: ASSETS.jungle_floor,
    sand: ASSETS.sand,
    canyonFloor: ASSETS.canyon_floor,
    waterNormal: ASSETS.water_n,
  },
  sounds: { ambience: ASSETS.ambience },
};
