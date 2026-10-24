"""Builds the game's props (every learner-facing text EN/FR, sample lanterns, asset URLs).

python3 dev/props_source.py <assets.json> <out.json>
assets.json maps asset ids (see ../../assets/manifest.json) to URLs; the same text is used for the
published variant and for local testing (with local URLs).
"""
import json
import sys


def L(en, fr):
    return {"en": en, "fr": fr}


UI = {
    "title": L("Idea Grove", "Le Bosquet des idées"),
    "tagline": L("The heart of EdVerse OpenWorld. Every lantern on the big tree is an idea a kid shared.",
                 "Le cœur d'EdVerse OpenWorld. Chaque lanterne du grand arbre est une idée partagée par un enfant."),
    "loading": L("The grove is growing…", "Le bosquet pousse…"),
    "chooseLook": L("Choose your explorer", "Choisis ton explorateur"),
    "yourName": L("Your explorer name", "Ton nom d'explorateur"),
    "newName": L("New name", "Autre nom"),
    "enter": L("Enter the grove", "Entrer dans le bosquet"),
    "howToKeys": L("Walk with the arrow keys or WASD. Press E to look at things.",
                   "Marche avec les flèches ou ZQSD. Appuie sur E pour regarder."),
    "howToTouch": L("Move with the round stick, or tap the ground. Tap lanterns, stalls and the telescope.",
                    "Déplace-toi avec le rond, ou touche le sol. Touche les lanternes, les stands et le télescope."),
    "ideaBy": L("Idea by {nickname}", "Idée de {nickname}"),
    "livesIn": L("Lives in: {place}", "Se trouve : {place}"),
    "builtOn": L("Built on {date}", "Construite le {date}"),
    "lanternCount": L("{n} idea lanterns", "{n} lanternes d'idées"),
    "noLanterns": L("This lantern is waiting for a new idea. Share yours in EdVerse, and it could light up here!",
                    "Cette lanterne attend une nouvelle idée. Partage la tienne dans EdVerse : elle pourrait s'allumer ici !"),
    "readLantern": L("Read the lantern", "Lire la lanterne"),
    "look": L("Look", "Regarder"),
    "comingSoon": L("Coming soon", "Bientôt"),
    "comingSoonText": L("Kids are dreaming up this place right now. It will open when it is built!",
                        "Des enfants imaginent cet endroit en ce moment. Il ouvrira quand il sera construit !"),
    "youWillLearn": L("You will learn:", "Tu vas apprendre :"),
    "close": L("Close", "Fermer"),
    "telescope": L("Star telescope", "Télescope des étoiles"),
    "useTelescope": L("Look at the stars", "Regarder les étoiles"),
    "skyTitle": L("Star telescope", "Télescope des étoiles"),
    "skyFind": L("Find: {name}", "Trouve : {name}"),
    "skyTapHint": L("Tap one star of the shape.", "Touche une étoile du dessin."),
    "skyTryAgain": L("Not this one. Look for the shape again!", "Pas celle-ci. Cherche encore la forme !"),
    "skyFound": L("You found it!", "Tu l'as trouvée !"),
    "skyNext": L("Next", "Suivant"),
    "skyShowMe": L("Show me", "Montre-moi"),
    "skyDone": L("Well done! You found 3 real constellations.", "Bravo ! Tu as trouvé 3 vraies constellations."),
    "skyAgain": L("Play again", "Rejouer"),
    "skyProgress": L("{n}/{total} constellations", "{n}/{total} constellations"),
    "say": L("Say something", "Dire quelque chose"),
    "settings": L("Settings", "Réglages"),
    "quality": L("Picture", "Image"),
    "qualityAuto": L("Auto", "Auto"),
    "qualityLow": L("Fast", "Rapide"),
    "qualityMedium": L("Nice", "Belle"),
    "qualityHigh": L("Best", "Superbe"),
    "sound": L("Sound", "Son"),
    "on": L("On", "Oui"),
    "off": L("Off", "Non"),
    "changeExplorer": L("Change explorer", "Changer d'explorateur"),
    "explorersHere": L("{n} explorers here", "{n} explorateurs ici"),
    "aloneHere": L("Just you here", "Tu es seul ici"),
    "roomNote": L("You meet explorers of your age.", "Tu rencontres des explorateurs de ton âge."),
    "hidePlayer": L("Hide", "Cacher"),
    "showPlayer": L("Show", "Montrer"),
    "paused": L("Paused", "En pause"),
    "lookLabel": L("Look", "Regarder"),
    "loadError": L("The grove could not open this time. Let's try again!", "Le bosquet n'a pas pu s'ouvrir cette fois. On réessaie !"),
    "retry": L("Try again", "Réessayer"),
}

LANTERNS = [
    {"nickname": "Brave Otter 42", "title": L("A star telescope to find real constellations", "Un télescope pour trouver de vraies constellations"),
     "where": "idea-grove", "shippedAt": "2026-10-24"},
    {"nickname": "Gentle Panda 08", "title": L("Wildflowers all around the big tree", "Des fleurs sauvages tout autour du grand arbre"),
     "where": "idea-grove", "shippedAt": "2026-10-22"},
    {"nickname": "Swift Heron 63", "title": L("Saying hello with a wave", "Dire bonjour en faisant coucou"),
     "where": "anywhere", "shippedAt": "2026-10-21"},
]

DISTRICTS = [
    {"id": "biome-frontier", "name": L("Biome Frontier", "La Frontière des biomes"),
     "teaser": L("Forests, beaches and reefs full of living things to discover.", "Des forêts, des plages et des récifs pleins d'êtres vivants à découvrir."),
     "learns": L("science and geography: plants, animals and where they live.", "les sciences et la géographie : les plantes, les animaux et leurs milieux."),
     "imageUrl": "https://content.mext.app/uploads/742bab29-d5ed-4458-9911-5c2c9ae774de.png",
     "imageAlt": L("A bright coast with forest, sea and sky", "Une côte lumineuse avec forêt, mer et ciel")},
    {"id": "chrono-quarter", "name": L("Chrono Quarter", "Le Quartier Chrono"),
     "teaser": L("Streets where every corner is a different time in history.", "Des rues où chaque coin est une époque de l'histoire."),
     "learns": L("history: how people lived, built and invented long ago.", "l'histoire : comment on vivait, construisait et inventait autrefois."),
     "imageUrl": "https://content.mext.app/uploads/a47b88b7-f930-4c09-96e5-d1ffeec56d33.png",
     "imageAlt": L("Old streets at dusk with buildings from many times", "Des rues anciennes au crépuscule, avec des bâtiments de plusieurs époques")},
    {"id": "skyharbor", "name": L("Skyharbor", "Port-Céleste"),
     "teaser": L("A night harbour of airships, planets and glowing machines.", "Un port de nuit avec des dirigeables, des planètes et des machines lumineuses."),
     "learns": L("space, engineering and coding.", "l'espace, l'ingénierie et le code."),
     "imageUrl": "https://content.mext.app/uploads/679b2158-b1c4-483a-a031-b915b270fc09.png",
     "imageAlt": L("A glowing harbour in the night sky", "Un port lumineux dans le ciel de nuit")},
]

DISTRICT_NAMES = [
    {"id": "idea-grove", "name": L("Idea Grove", "Le Bosquet des idées")},
    {"id": "biome-frontier", "name": L("Biome Frontier", "La Frontière des biomes")},
    {"id": "chrono-quarter", "name": L("Chrono Quarter", "Le Quartier Chrono")},
    {"id": "skyharbor", "name": L("Skyharbor", "Port-Céleste")},
    {"id": "anywhere", "name": L("Everywhere in the world", "Partout dans le monde")},
]

# star positions: real right ascension / declination projected into the telescope view (see README)
CONSTELLATIONS = [
    {"id": "big-dipper", "name": L("the Big Dipper", "la Grande Casserole"),
     "hint": L("Look for a big spoon of 7 stars: a box and a long handle.", "Cherche une grande cuillère de 7 étoiles : une boîte et un long manche."),
     "fact": L("The Big Dipper is part of the Great Bear. Its two end stars point to the North Star.",
               "La Grande Casserole fait partie de la Grande Ourse. Ses deux étoiles du bout montrent l'étoile Polaire."),
     "stars": [{"x": 38.8, "y": 17.5, "size": 1.7}, {"x": 39.2, "y": 24.9, "size": 1.45}, {"x": 29.1, "y": 28.6, "size": 1.4}, {"x": 24.9, "y": 24.0, "size": 0.95},
               {"x": 17.4, "y": 25.5, "size": 1.7}, {"x": 11.6, "y": 26.9, "size": 1.5}, {"x": 7.0, "y": 34.6, "size": 1.65}],
     "lines": [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]},
    {"id": "orion", "name": L("Orion the Hunter", "Orion le chasseur"),
     "hint": L("Look for 3 stars in a row: that is his belt.", "Cherche 3 étoiles alignées : c'est sa ceinture."),
     "fact": L("Orion's belt is 3 stars in a row. The red star Betelgeuse is his shoulder.",
               "La ceinture d'Orion, ce sont 3 étoiles alignées. L'étoile rouge Bételgeuse est son épaule."),
     "stars": [{"x": 64.7, "y": 27.3, "size": 2.35}, {"x": 76.0, "y": 28.9, "size": 1.8}, {"x": 70.2, "y": 41.4, "size": 1.7}, {"x": 71.8, "y": 40.3, "size": 1.75},
               {"x": 73.4, "y": 38.9, "size": 1.5}, {"x": 67.5, "y": 53.0, "size": 1.55}, {"x": 80.0, "y": 50.8, "size": 2.55}, {"x": 72.3, "y": 23.5, "size": 0.9}],
     "lines": [[7, 0], [7, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]]},
    {"id": "cassiopeia", "name": L("Cassiopeia", "Cassiopée"),
     "hint": L("Look for a W made of 5 stars.", "Cherche un W fait de 5 étoiles."),
     "fact": L("Cassiopeia looks like a W. It is on the other side of the North Star from the Big Dipper.",
               "Cassiopée ressemble à un W. Elle est de l'autre côté de l'étoile Polaire, en face de la Grande Casserole."),
     "stars": [{"x": 52.8, "y": 75.8, "size": 1.45}, {"x": 45.1, "y": 80.9, "size": 1.5}, {"x": 41.1, "y": 72.7, "size": 1.5}, {"x": 34.0, "y": 73.7, "size": 1.25},
               {"x": 27.0, "y": 66.9, "size": 0.9}],
     "lines": [[0, 1], [1, 2], [2, 3], [3, 4]]},
]

PHRASES = [
    {"id": "hello", "icon": "😊", "text": L("Hello!", "Salut !"), "anim": "wave"},
    {"id": "look", "icon": "👀", "text": L("Look!", "Regarde !"), "anim": "none"},
    {"id": "follow", "icon": "👣", "text": L("Follow me!", "Suis-moi !"), "anim": "none"},
    {"id": "thanks", "icon": "💛", "text": L("Thank you!", "Merci !"), "anim": "none"},
    {"id": "great-idea", "icon": "💡", "text": L("Great idea!", "Super idée !"), "anim": "cheer"},
    {"id": "lets-build", "icon": "🔨", "text": L("Let's build!", "On construit !"), "anim": "none"},
    {"id": "wave", "icon": "👋", "text": L("Wave", "Coucou"), "anim": "wave"},
    {"id": "cheer", "icon": "🎉", "text": L("Hooray!", "Hourra !"), "anim": "cheer"},
]

AVATARS = [
    {"id": "sunny", "skin": "#f1c7a5", "hair": "#5a3825", "shirt": "#f08a3c", "pants": "#3f5f8f", "shoes": "#7a4a2a", "bag": "#5c9b4a"},
    {"id": "lagoon", "skin": "#8d5a3b", "hair": "#1f1410", "shirt": "#3fa7a0", "pants": "#c9a66b", "shoes": "#2f3a56", "bag": "#e76f51"},
    {"id": "violet", "skin": "#d9a27c", "hair": "#c46a2b", "shirt": "#8e6cc9", "pants": "#2d4a3e", "shoes": "#e0b04a", "bag": "#f2a541"},
    {"id": "honey", "skin": "#5e3a26", "hair": "#2a1b14", "shirt": "#e9c46a", "pants": "#264653", "shoes": "#b23a48", "bag": "#4a90c2"},
    {"id": "fern", "skin": "#f6d7bf", "hair": "#e8c872", "shirt": "#5aa469", "pants": "#6b4f3a", "shoes": "#3d5a80", "bag": "#c8553d"},
    {"id": "berry", "skin": "#b67b56", "hair": "#3b2a1e", "shirt": "#d1495b", "pants": "#3a6ea5", "shoes": "#f4f1de", "bag": "#8ab17d"},
]

ADJ = ["Brave", "Curious", "Gentle", "Swift", "Clever", "Happy", "Sunny", "Bright", "Kind", "Bold", "Calm", "Cheerful", "Cosy",
       "Daring", "Eager", "Friendly", "Jolly", "Lucky", "Merry", "Nimble", "Patient", "Playful", "Quiet", "Quick", "Sparkly",
       "Spotted", "Starry", "Steady", "Witty", "Wise"]
ANIMALS = ["Otter", "Fox", "Panda", "Heron", "Owl", "Hedgehog", "Turtle", "Badger", "Koala", "Lynx", "Dolphin", "Penguin",
           "Rabbit", "Squirrel", "Beaver", "Llama", "Gecko", "Puffin", "Seal", "Sparrow", "Wombat", "Zebra", "Moose", "Robin",
           "Tiger", "Whale", "Kiwi", "Lemur", "Yak", "Bee"]


def build(urls):
    return {
        "ui": UI,
        "lanterns": LANTERNS,
        "districts": DISTRICTS,
        "districtNames": DISTRICT_NAMES,
        "constellations": CONSTELLATIONS,
        "phrases": PHRASES,
        "avatars": AVATARS,
        "nicknameAdjectives": ADJ,
        "nicknameAnimals": ANIMALS,
        "models": {k: urls[v] for k, v in {
            "tree": "idea_tree", "forestTree": "forest_tree", "lantern": "lantern", "plaza": "plaza",
            "stallBiome": "stall_biome", "stallChrono": "stall_chrono", "stallSky": "stall_sky", "telescope": "telescope",
            "boulders": "boulders", "fern": "fern", "flowers": "flowers", "grassTuft": "grass_tuft", "avatar": "kid_avatar"}.items()},
        "textures": {"grass": urls["ground_grass"], "dirt": urls["ground_dirt"]},
        "sounds": {"ambience": urls["grove_ambience"], "chime": urls["chime"], "pop": urls["pop"], "success": urls["success"]},
    }


if __name__ == "__main__":
    urls = json.load(open(sys.argv[1]))
    json.dump(build(urls), open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
    print("wrote", sys.argv[2])
