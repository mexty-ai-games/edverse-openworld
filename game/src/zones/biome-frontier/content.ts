// Default content of the Biome Frontier (EN + FR) and its asset URLs. Facts are real and checkable
// (sources noted per fact in docs-style comments); everything here is a prop the store can override.
import type { BiomeFrontierProps } from "./types";
import { ASSETS } from "./assets.gen";
import { P2_ASSETS as P2 } from "../../expedition/assets.gen";

const L = (en: string, fr: string) => ({ en, fr });

export const defaultProps: BiomeFrontierProps = {
  ui: {
    title: L("Biome Frontier", "La Frontière des biomes"),
    showMe: L("Show me", "Montre-moi"),
    next: L("Next", "Suivant"),
    close: L("Close", "Fermer"),
    digTitle: L("Fossil dig", "Fouille de fossiles"),
    digIntro: L(
      "This dig block has 4 layers of soil and rock. Scrape them away one at a time with the trowel, and brush each fossil clean.",
      "Ce bloc de fouille a 4 couches de terre et de roche. Retire-les une par une avec la truelle, et nettoie chaque fossile avec la brosse.",
    ),
    digDone: L("Dig finished!", "Fouille terminée !"),
    layerLabel: L("Layer {n}", "Couche {n}"),
    stationTitle: L("Field station", "Station de terrain"),
    playAgain: L("New survey", "Nouvelle exploration"),
    easyMode: L("Pictures", "Images"),
    explorerMode: L("Explorer", "Explorateur"),
    modeLabel: L("Mode", "Mode"),
    backToGrove: L("Back to the Idea Grove", "Retour au Bosquet des idées"),
    look: L("Look", "Regarder"),
    digWaiting: L("Waiting in the canyon", "T'attend dans le canyon"),
    digNeedTools: L("You need a trowel and a brush to dig. The Grove Keeper will give them to you.", "Il te faut une truelle et une brosse pour fouiller. Le Gardien du bosquet te les donnera."),
    trowel: L("Trowel", "Truelle"),
    brush: L("Brush", "Brosse"),
    trowelHint: L("Rub the trowel back and forth over the top layer to scrape it away.", "Frotte la truelle d'avant en arrière sur la couche du dessus pour la retirer."),
    brushHint: L("A fossil! Rub the soft brush over it, gently, to clean it.", "Un fossile ! Passe doucement la brosse dessus pour le nettoyer."),
    useBrush: L("Careful! A fossil is fragile: use the soft brush.", "Attention ! Un fossile est fragile : utilise la brosse douce."),
    useTrowel: L("The brush is too soft for soil. Use the trowel.", "La brosse est trop douce pour la terre. Utilise la truelle."),
    brushFirst: L("Brush the fossil out first, before you dig deeper.", "Dégage d'abord le fossile avec la brosse, avant de creuser plus profond."),
    layerGone: L("Layer {n} is gone. Deeper means older!", "La couche {n} est enlevée. Plus profond, c'est plus ancien !"),
    fossilFound: L("Fossil found!", "Fossile trouvé !"),
    timeline: L("Your timeline", "Ta frise du temps"),
    timelineNow: L("Today", "Aujourd'hui"),
    deeperOlder: L("The deeper you dig, the older it is: the order you found them is a timeline!", "Plus on creuse, plus c'est ancien : l'ordre où tu les as trouvés est une frise du temps !"),
    mya: L("{n} million years ago", "il y a {n} millions d'années"),
    digAgain: L("Fill it in and dig again", "Reboucher et refouiller"),
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
  fossils: [
    {
      id: "shark-tooth", layer: 0, icon: "🦈", ageMyr: 15, name: L("Shark tooth", "Dent de requin"),
      age: L("about 15 million years old", "environ 15 millions d'années"), period: L("Miocene", "Miocène"),
      fact: L(
        "Sharks lose and replace their teeth all their lives, so fossil shark teeth are among the most common fossils. Giant megalodon sharks lived from about 23 to 3.6 million years ago.",
        "Les requins perdent et remplacent leurs dents toute leur vie : les dents de requin fossiles sont parmi les fossiles les plus courants. Le requin géant mégalodon a vécu il y a environ 23 à 3,6 millions d'années.",
      ),
      factEasy: L("Sharks grow new teeth all their lives!", "Les requins ont de nouvelles dents toute leur vie !"),
      source: "Smithsonian Ocean, “Megalodon”; Florida Museum of Natural History, “Fossil shark teeth”",
      modelUrl: P2["dig:fossil:shark_tooth"] || "", iconUrl: P2["dig:fossil:shark_tooth:icon"] || "", spot: [-0.22, 0.752, -0.12],
    },
    {
      id: "dino-bone", layer: 1, icon: "🦴", ageMyr: 70, name: L("Dinosaur bone", "Os de dinosaure"),
      age: L("about 70 million years old", "environ 70 millions d'années"), period: L("Late Cretaceous", "Crétacé supérieur"),
      fact: L(
        "Dinosaurs (all but the birds!) died out about 66 million years ago, so this bone is older than that. Over a very long time, minerals in the ground slowly turned it into stone.",
        "Les dinosaures (sauf les oiseaux !) ont disparu il y a environ 66 millions d'années : cet os est donc plus ancien. Pendant très longtemps, les minéraux du sol l'ont lentement changé en pierre.",
      ),
      factEasy: L("A real dinosaur bone, turned to stone!", "Un vrai os de dinosaure, changé en pierre !"),
      source: "Natural History Museum, London, “How do fossils form?”; Encyclopaedia Britannica, “Dinosaur”",
      modelUrl: P2["dig:fossil:dino_bone"] || "", iconUrl: P2["dig:fossil:dino_bone:icon"] || "", spot: [0.1, 0.59, 0.1],
    },
    {
      id: "ammonite", layer: 2, icon: "🐚", ageMyr: 150, name: L("Ammonite", "Ammonite"),
      age: L("about 150 million years old", "environ 150 millions d'années"), period: L("Jurassic", "Jurassique"),
      fact: L(
        "Ammonites were sea animals with coiled shells, cousins of today's octopus and nautilus. They swam in the seas for millions of years and died out 66 million years ago, with the dinosaurs.",
        "Les ammonites étaient des animaux marins à coquille enroulée, cousins de la pieuvre et du nautile. Elles ont nagé dans les mers pendant des millions d'années et ont disparu il y a 66 millions d'années, avec les dinosaures.",
      ),
      factEasy: L("A sea animal with a curly shell.", "Un animal de la mer à coquille enroulée."),
      source: "Natural History Museum, London, “Ammonites”",
      modelUrl: P2["dig:fossil:ammonite"] || "", iconUrl: P2["dig:fossil:ammonite:icon"] || "", spot: [-0.15, 0.4, -0.2],
    },
    {
      id: "fern", layer: 3, icon: "🌿", ageMyr: 300, name: L("Fern leaf", "Feuille de fougère"),
      age: L("about 300 million years old", "environ 300 millions d'années"), period: L("Carboniferous", "Carbonifère"),
      fact: L(
        "About 300 million years ago, in the Carboniferous period, huge swampy forests of ferns and giant plants grew. Their remains slowly became coal.",
        "Il y a environ 300 millions d'années, au Carbonifère, d'immenses forêts marécageuses de fougères et de plantes géantes poussaient. Leurs restes sont lentement devenus du charbon.",
      ),
      factEasy: L("A fern from a very old forest.", "Une fougère d'une très vieille forêt."),
      source: "Encyclopaedia Britannica, “Carboniferous Period”",
      modelUrl: P2["dig:fossil:fern"] || "", iconUrl: P2["dig:fossil:fern:icon"] || "", spot: [0.2, 0.212, -0.18],
    },
    {
      id: "trilobite", layer: 4, icon: "🪨", ageMyr: 500, name: L("Trilobite", "Trilobite"),
      age: L("about 500 million years old", "environ 500 millions d'années"), period: L("Cambrian", "Cambrien"),
      fact: L(
        "Trilobites were sea animals with jointed legs, distant cousins of today's insects and crabs. They first appeared about 521 million years ago and lived for nearly 300 million years.",
        "Les trilobites étaient des animaux marins aux pattes articulées, lointains cousins des insectes et des crabes. Ils sont apparus il y a environ 521 millions d'années et ont vécu près de 300 millions d'années.",
      ),
      factEasy: L("A very, very old sea animal.", "Un très, très vieil animal marin."),
      source: "Natural History Museum, London, “Trilobites”",
      modelUrl: P2["dig:fossil:trilobite"] || "", iconUrl: P2["dig:fossil:trilobite:icon"] || "", spot: [-0.2, 0.17, 0.18],
    },
  ],
  layersFact: L(
    "Mud and sand settle in layers, one on top of another, over a very long time. So the deeper you dig, the older the layer: the order you found the fossils is a timeline. Trilobites and ammonites lived in the sea, so this canyon was under the sea long ago!",
    "La boue et le sable se déposent en couches, les unes sur les autres, pendant très longtemps. Plus on creuse, plus la couche est ancienne : l'ordre dans lequel tu as trouvé les fossiles est une frise du temps. Les trilobites et les ammonites vivaient dans la mer : ce canyon était sous la mer il y a très longtemps !",
  ),
  layersFactEasy: L("New layers go on top. The deeper, the older!", "Les nouvelles couches vont dessus. Plus c'est profond, plus c'est ancien !"),
  models: {
    jungleTree: ASSETS.jungle_tree,
    palm: ASSETS.palm,
    giantLeaves: ASSETS.giant_leaf_plants,
    waterfallCliff: ASSETS.waterfall_cliff,
    canyonRocks: ASSETS.canyon_rocks,
    digSite: ASSETS.dig_site,
    digBlock: P2["dig:block"] || "",
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
