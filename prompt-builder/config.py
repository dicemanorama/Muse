import os
import sys

try:
    from dotenv import load_dotenv

    _env_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
    )
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
    else:
        load_dotenv()
except ImportError:
    print(
        "[config] python-dotenv not installed; .env will not be loaded. "
        "Run: pip install -r requirements.txt",
        file=sys.stderr,
    )


OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "hermes3:8b").strip()
STORAGE_DB_PATH = os.environ.get(
    "STORAGE_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage.db"),
)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.environ.get(
    "OPENROUTER_MODEL", "google/gemma-3-12b-it"
).strip()

MODEL_NAME = OPENROUTER_MODEL if OPENROUTER_API_KEY else OLLAMA_MODEL

if not OPENROUTER_API_KEY:
    print(
        "[config] OPENROUTER_API_KEY is empty; OpenRouter model will appear as unavailable in the UI.",
        file=sys.stderr,
    )


MJ_SYSTEM_PROMPT = (
    "You are a world-class Midjourney v7 prompt engineer, art director, and cinematographer. "
    "Your job is to transform the user's selected tags and free-text notes into a SINGLE, "
    "richly detailed, cohesive Midjourney v7 prompt that reads like an art-direction brief, "
    "not a comma list of disconnected keywords.\n\n"

    "OUTPUT FORMAT (strict):\n"
    "- Return exactly one prompt as a single paragraph of descriptive clauses separated by commas.\n"
    "- Natural language first: use vivid sentence fragments and descriptive phrases — avoid flat "
    "  keyword dumps like 'cat, forest, moon, night'.\n"
    "- NEVER include Midjourney parameter flags (--ar, --v, --s, --c, --w, --q, --style, --niji, "
    "  --chaos, --stylize, --weird). Those are appended by the UI.\n"
    "- NEVER use Midjourney weight syntax ('::', '::2', '::-1', etc.). Express emphasis with vivid "
    "  wording instead.\n"
    "- NEVER include preambles, labels, explanations, quotes, markdown, or trailing commentary.\n"
    "- NEVER mention that you are an AI or describe what you are doing.\n\n"

    "PROMPT STRUCTURE (follow this order, weave smoothly):\n"
    "  1. HERO SUBJECT — specific, concrete, sensory. Name it, describe its posture, expression, "
    "     materials, clothing, texture, scale.\n"
    "  2. ENVIRONMENT / CONTEXT — where it is, what surrounds it, foreground/background cues.\n"
    "  3. COMPOSITION / CAMERA — shot type, lens, angle, framing (e.g. 'low-angle hero shot', "
    "     '85mm portrait lens, shallow depth of field', 'symmetrical wide establishing shot').\n"
    "  4. LIGHTING — concrete physical description, not just a label.\n"
    "  5. COLOR / PALETTE — dominant hues, contrast behavior, saturation character.\n"
    "  6. STYLE / MEDIUM / ARTISTIC REFERENCE — painting style, film reference, or artist lineage "
    "     (e.g. 'in the tradition of Roger Deakins cinematography', 'Studio Ghibli matte painting', "
    "     'Zdzisław Beksiński oil'). Use taste; do not name-drop when it does not fit.\n"
    "  7. MOOD / EMOTION — the feeling the image should evoke.\n"
    "  8. QUALITY BOOSTERS — close with 1-3 effective phrases such as 'ultra-detailed, cinematic, "
    "     8k, award-winning, volumetric atmosphere'. Do not over-stack generic boosters.\n\n"

    "MIDJOURNEY SYNTAX AWARENESS:\n"
    "- Group multi-word concepts so they read as a unit.\n"
    "- Prefer concrete nouns and active, sensory adjectives over vague words like 'beautiful', "
    "  'amazing', 'nice'.\n\n"

    "CONTEXT-AWARE ENHANCEMENT — adapt language when these tags appear:\n"
    "- 'creature' + (cinematic / oil painting / concept art) → lean into epic fantasy matte-painting "
    "  language: 'colossal scale, towering silhouette, mythic presence, painterly brushwork'.\n"
    "- 'landscape' → emphasize depth cues, atmospheric perspective, layered distance, a sense of scale "
    "  (a lone figure, a distant structure, birds for size reference).\n"
    "- 'person' or 'portrait lens' → emphasize skin detail, catchlights in the eyes, soft rim light, "
    "  gentle subsurface scattering, shallow depth of field, bokeh.\n"
    "- 'architecture' → emphasize material accuracy (weathered concrete, patinated bronze, etched "
    "  stone), volumetric light passing through structure, human scale reference.\n"
    "- 'abstract' → emphasize form, rhythm, negative space, compositional balance, texture; avoid "
    "  literal subject descriptions.\n"
    "- 'vehicle' → emphasize materials (brushed aluminum, worn leather, rain-beaded glass), motion "
    "  or stillness, reflections, environmental grounding.\n\n"

    "LIGHTING REINFORCEMENT — whenever a Lighting tag is present, translate it into a concrete "
    "physical cue. Examples:\n"
    "- 'golden hour' → 'long raking sunlight, amber rim light, warm haze catching in the air'.\n"
    "- 'neon-lit' → 'magenta and cyan neon bleeding across wet asphalt, hard colored reflections'.\n"
    "- 'volumetric' → 'god rays cutting through particulate air, visible shafts of light'.\n"
    "- 'candlelight' → 'flickering amber glow, deep falloff, soft warm highlights on skin'.\n"
    "- 'overcast' → 'soft diffused grey light, flat shadow contrast, matte atmosphere'.\n"
    "- 'studio' → 'clean key light with soft fill, controlled falloff, seamless backdrop'.\n\n"

    "MOOD LAYERING — reinforce the Mood tag with a sensory anchor (a sound implied, a gesture, "
    "a weather cue) rather than just the adjective.\n\n"

    "ACTION REINFORCEMENT — whenever an Action tag is present, translate it into a concrete "
    "verb-phrase with body language, momentum, and a frozen-instant cue rather than the bare "
    "verb. Examples:\n"
    "- 'running' → 'mid-stride sprint, hair streaming back, dust kicking up at the heels'.\n"
    "- 'casting a spell' → 'arms raised, fingers splayed, glowing sigils swirling at the palms'.\n"
    "- 'drawing a sword' → 'blade half-cleared of the scabbard, knuckles white on the grip'.\n"
    "- 'meditating' → 'cross-legged, spine straight, eyes softly closed, breath visible in cool air'.\n"
    "- 'falling' → 'limbs splayed against the wind, clothing whipping upward, weightless suspension'.\n"
    "- 'embracing' → 'foreheads almost touching, hands cradling the back of the head, tender weight'.\n\n"

    "Return ONLY the final single-paragraph prompt."
)


SDXL_SYSTEM_PROMPT = (
    "You are an expert SDXL / ComfyUI prompt engineer with deep knowledge of what SDXL attends to: "
    "front-loaded tokens, mixed natural sentences + comma-separated descriptors, and strong negative "
    "prompts that suppress common failure modes.\n\n"

    "CRITICAL OUTPUT FORMAT — follow EXACTLY, no deviation:\n"
    "Line 1 must begin with 'POSITIVE:' followed by the positive prompt.\n"
    "Then a blank line.\n"
    "Then a line beginning with 'NEGATIVE:' followed by the negative prompt.\n"
    "No other text before, between, or after. No markdown, no code fences, no commentary, no quotes, "
    "no labels other than POSITIVE: and NEGATIVE:. The downstream parser requires this exact shape.\n\n"

    "Template:\n"
    "POSITIVE: <positive prompt>\n"
    "\n"
    "NEGATIVE: <negative prompt>\n\n"

    "POSITIVE PROMPT GUIDANCE:\n"
    "- Front-load the hero subject and its single strongest stylistic anchor in the first ~8 tokens "
    "  (SDXL weights early tokens more heavily).\n"
    "- Use a natural hybrid: one or two descriptive clauses that read like a sentence, followed by "
    "  rich comma-separated descriptors for medium, lighting, color, composition, texture, and mood.\n"
    "- Always close with a short quality-booster tail tuned to the style:\n"
    "    * Photorealistic / portrait → 'masterpiece, best quality, highly detailed, sharp focus, "
    "      8k, professional photography, dslr, film grain'.\n"
    "    * Painting / concept art / illustration → 'masterpiece, best quality, highly detailed, "
    "      intricate, cinematic composition, trending on ArtStation'.\n"
    "    * Anime → 'masterpiece, best quality, highly detailed, sharp lineart, vibrant, "
    "      cel shading'.\n"
    "- Do NOT include POSITIVE: or NEGATIVE: inside the actual prompt text of either section.\n"
    "- Do NOT include Midjourney flags (--ar, --v, etc.).\n\n"

    "CONTEXT-AWARE ENHANCEMENT — adapt to the tag categories present:\n"
    "- 'creature' + painterly style → 'mythic scale, fantasy matte painting, painterly brushwork, "
    "  epic silhouette'.\n"
    "- 'landscape' → 'sweeping vista, atmospheric perspective, layered depth, scale reference'.\n"
    "- 'person' / 'portrait lens' → 'detailed skin texture, realistic eyes with catchlights, "
    "  shallow depth of field, soft bokeh, rim light'.\n"
    "- 'architecture' → 'accurate materials, volumetric light, human scale reference, wide establishing "
    "  composition'.\n"
    "- 'abstract' → 'compositional rhythm, negative space, textural richness, balanced form'.\n"
    "- 'vehicle' → 'accurate materials, reflective surfaces, environmental grounding, motion or "
    "  stillness cue'.\n\n"

    "LIGHTING REINFORCEMENT — translate the lighting tag into concrete physical descriptors, not just "
    "the label (golden hour → 'warm raking sunlight, amber rim light'; neon-lit → 'magenta and cyan "
    "neon, wet asphalt reflections'; volumetric → 'god rays, visible light shafts, particulate air').\n\n"

    "ACTION REINFORCEMENT — translate the action tag into concrete motion descriptors, not just "
    "the verb (running → 'mid-stride sprint, motion blur at the heels, hair streaming back'; "
    "casting a spell → 'arms raised, glowing sigils, swirling magical energy'; drawing a sword "
    "→ 'blade half-drawn, tense grip, ready stance'; falling → 'limbs splayed, clothing "
    "whipping upward, weightless suspension').\n\n"

    "NEGATIVE PROMPT GUIDANCE — ALWAYS comprehensive. Build from these banks, chosen by style:\n"
    "- QUALITY (always include): 'low quality, worst quality, normal quality, lowres, jpeg artifacts, "
    "  blurry, out of focus, grainy, oversaturated, overexposed, underexposed, washed out'.\n"
    "- ANATOMY (always include when a person/creature is present): 'bad anatomy, bad proportions, "
    "  bad hands, bad fingers, extra fingers, missing fingers, fused fingers, extra limbs, missing "
    "  limbs, mutated hands, poorly drawn hands, poorly drawn face, disfigured, deformed, asymmetric "
    "  eyes, cross-eyed'.\n"
    "- ARTIFACTS (always include): 'watermark, signature, signed, autograph, text, logo, username, "
    "  artist name, copyright, cropped, frame, border, out of frame, duplicate, error'.\n"
    "- MANDATORY (always include, every SDXL negative prompt): 'signature, signed, autograph, "
    "  watermark, logo, text, username, artist name, copyright'.\n"
    "- STYLE-BLEED (choose based on selected style):\n"
    "    * If the target style is photorealistic/photography → add 'cartoon, anime, 3d render, cgi, "
    "      illustration, painting, sketch, render'.\n"
    "    * If the target style is anime/illustration/painting → add 'realistic, photo, photograph, "
    "      photorealistic, 3d render'.\n"
    "    * If the target style is oil painting/watercolor/concept art → add 'photograph, 3d render, "
    "      plastic, uncanny'.\n"
    "- Output the negative as a single line of comma-separated descriptors, no sentences.\n\n"

    "Return ONLY the two labeled sections, in the exact format above."
)


REFINE_SYSTEM_PROMPT = (
    "You are an expert prompt refiner for text-to-image models. You will receive an existing "
    "image-generation prompt. Your task is to improve it so the resulting image will be more vivid, "
    "more detailed, more cohesive, and more evocative — while strictly PRESERVING the original "
    "intent, subject, style, medium, and mood.\n\n"

    "RULES:\n"
    "- Do NOT invent a different scene, different subject, or different style.\n"
    "- Strengthen weak or generic adjectives ('beautiful', 'nice', 'cool') with specific sensory ones.\n"
    "- Tighten redundant phrasing and remove filler.\n"
    "- Add targeted detail in lighting, material, texture, and atmosphere where the original is thin.\n"
    "- Reinforce compositional clarity (camera, framing, depth) only when the original implies it.\n"
    "- Keep the prompt as a single coherent paragraph of descriptive clauses.\n"
    "- NEVER add Midjourney parameter flags (--ar, --v, --s, --c, --w, --q, --style).\n"
    "- NEVER add POSITIVE: / NEGATIVE: labels.\n"
    "- NEVER add preamble, commentary, explanation, markdown, or quotes.\n\n"

    "Return ONLY the refined prompt text."
)


TITLE_SYSTEM_PROMPT = (
    "You name image-generation prompts for quick reference in a UI.\n\n"
    "RULES:\n"
    "- Output exactly ONE line: a short descriptive title only.\n"
    "- About 4–10 words; Title Case is fine but not required.\n"
    "- Summarize the main subject, setting, and mood — not every detail.\n"
    "- No quotation marks, no colons, no labels like 'Title:', no preamble or explanation.\n"
    "- Do not mention Midjourney, SDXL, prompts, or AI.\n\n"
    "Return ONLY the title line."
)


TAGS = {
    "Subject": [
        "person",
        "landscape",
        "creature",
        "architecture",
        "abstract",
        "vehicle",
        "still life",
        "cityscape",
        "underwater",
        "space scene",
        "food",
        "fashion",
        "wildlife",
        "interior design",
        "mythology",
        "cyberpunk character",
        "desert caravan",
        "ancient ruins explorer",
        "steampunk inventor",
        "robot companion",
        "mecha pilot",
        "forest spirit",
        "wizard alchemist",
        "samurai duel",
        "pirate captain",
        "deep sea leviathan",
        "mountain monastery",
        "floating islands",
        "alien marketplace",
        "space colony",
        "post-apocalyptic convoy",
        "victorian detective",
        "street musician",
        "festival parade",
        "dreamscape traveler",
        "ice kingdom",
        "volcanic temple",
        "rainforest expedition",
        "arctic outpost",
        "deserted amusement park",
        "ancient library",
        "clockwork automaton",
        "battlefield medic",
        "desert nomad",
        "mythic beast rider",
        "haunted mansion",
        "underworld gate",
        "celestial guardian",
        "futuristic athlete",
        "retro astronaut",
        "ocean cliff village",
        "abandoned subway station",
        "wild west saloon",
        "hidden jungle city",
        "high fantasy tavern",
        "biomechanical organism",
        "dragon hatchling",
        "shadow assassin",
        "neon street racer",
        "lighthouse keeper",
        "tribal shaman",
        "crystal miner",
        "star cartographer",
        "underwater research lab",
        "sunken galleon shipwreck",
        "cyberpunk hacker den",
        "cosmic whale migration",
        "vampire masquerade ball",
        "werewolf pack hunt",
        "ghost ship crew",
        "fae court gathering",
        "necromancer's tower",
        "bounty hunter android",
        "plague doctor",
        "junkyard scavenger",
        "storm chaser",
        "monastery scribe",
        "bioluminescent jungle",
        "interstellar diplomat",
        "zero-gravity dancer",
        "royal falconer",
        "graveyard caretaker",
        "stained glass artisan",
        "nomadic skyship",
        "titan mecha duel",
        "ethereal phoenix",
        "celestial observatory",
        "shogun's war camp",
        "frost giant chieftain",
        "elven ranger archer",
        "kraken surfacing",
        "desert oracle seer",
        "sand pirate queen",
        "clocktower bell ringer",
        "holographic street busker",
        "moss golem warden",
        "volcanic forge master",
        "ice witch sovereign",
        "silk road merchant",
        "opera diva",
        "submarine captain",
        "pollen fairy swarm",
        "raven witch familiar",
        "katana swordsmith",
        "lunar eclipse priestess",
        "coral mermaid court",
        "scrap metal sculptor",
        "hologram news anchor",
        "pine spirit guide",
        "avalanche rescue crew",
        "carnival strongman",
        "rooftop beekeeper",
        "canyon rope acrobat",
        "bone golem necromancer",
        "solar eclipse cultist",
        "windmill miller",
        "cherry blossom geisha",
        "quantum garden botanist",
    ],
    "Location": [
        "forest clearing",
        "desert dunes",
        "mountain range",
        "coastal cliffs",
        "tropical beach",
        "dense jungle",
        "snowy tundra",
        "ancient temple",
        "medieval castle",
        "futuristic megacity",
        "quiet village",
        "bustling marketplace",
        "rooftop garden",
        "abandoned factory",
        "hidden cave",
        "underwater ruins",
        "floating city",
        "space station",
        "volcanic crater",
        "canyon overlook",
        "misty swamp",
        "sakura park",
        "bamboo forest",
        "old library hall",
        "gothic cathedral",
        "subway platform",
        "train yard",
        "harbor docks",
        "lighthouse island",
        "river delta",
        "glacier valley",
        "oasis camp",
        "rooftop penthouse",
        "desert highway",
        "lunar surface",
        "alien planet plain",
        "arctic research base",
        "rainforest canopy",
        "cliffside monastery",
        "ruined colosseum",
        "sunken city plaza",
        "foggy harbor town",
        "crystal cavern",
        "windmill farmlands",
        "frozen waterfall",
        "lava tube tunnel",
        "clifftop lighthouse",
        "ancient amphitheater",
        "underground bunker",
        "desert canyon pass",
        "mangrove lagoon",
        "stormy coastline",
        "highland moors",
        "urban alleyway",
        "botanical conservatory",
        "mountain pass road",
        "riverfront boardwalk",
        "obsidian wasteland",
        "ice cave chamber",
        "sunflower meadow",
        "vineyard hillside",
        "temple courtyard",
        "orbital shipyard",
        "redwood grove",
        "salt flat expanse",
        "steppe grasslands",
        "coral reef shelf",
        "monsoon rice terraces",
        "cliffside ruins",
        "meteor crater rim",
        "alpine meadow",
        "lavender fields",
        "bamboo waterfront dock",
        "cliff-top fortress",
        "abandoned amusement pier",
        "frontier crossroads",
        "glacier crevasse bridge",
        "underwater kelp forest",
        "volcanic ash plains",
        "cherry orchard hillside",
        "abandoned mine shaft",
        "neon-lit rooftop overlook",
        "moorland stone circle",
        "bamboo rope bridge",
        "alpine refuge hut",
        "sunken subway tunnel",
        "cathedral crypt",
        "zen rock garden courtyard",
        "salt marsh boardwalk",
        "bamboo tea pavilion",
        "fjord cliff overlook",
        "hidden oasis spring",
        "frozen lake village",
        "tropical atoll lagoon",
        "alpine cable car station",
        "underground aqueduct",
        "neon harbor warehouse district",
        "cliff-face monastery stairs",
        "bamboo maze garden",
        "starlit desert plateau",
        "abandoned airship hangar",
        "bioluminescent cave grotto",
        "coastal tide pool terraces",
        "derelict orbital ring segment",
        "enchanted mushroom grove",
        "fog-shrouded cemetery hill",
        "geothermal hot spring valley",
        "hanging cliffside village",
        "iceberg arch passage",
        "jasmine terrace courtyard",
        "kaleidoscope glass conservatory",
        "limestone karst peaks",
        "midnight carnival midway",
        "neon rain-slick backstreet",
        "overgrown victorian greenhouse",
        "pearl lagoon sandbar",
        "quartz crystal canyon",
        "rooftop koi pond terrace",
        "sandstone slot canyon",
        "thunderhead mountain summit",
        "underwater geyser vents",
        "gilded opera house foyer",
        "misty birch ridgeline",
        "meteorite impact garden",
        "spice market souk alley",
        "ancient ziggurat summit",
        "amber-lit river bend",
        "copper mine elevator shaft",
        "dragonbone bridge gorge",
        "palm oasis canyon floor",
    ],
    "Action": [
        "standing still",
        "walking",
        "running",
        "sprinting",
        "jumping",
        "leaping mid-air",
        "falling",
        "flying",
        "soaring",
        "hovering",
        "levitating",
        "floating weightlessly",
        "swimming",
        "diving underwater",
        "climbing",
        "scaling a cliff",
        "riding a horse",
        "riding a mount",
        "driving",
        "piloting",
        "sitting cross-legged",
        "kneeling",
        "crouching",
        "lying down",
        "sleeping",
        "meditating",
        "praying",
        "reading",
        "writing",
        "drinking",
        "eating",
        "cooking",
        "dancing",
        "singing",
        "playing an instrument",
        "embracing",
        "kissing",
        "holding hands",
        "fighting",
        "dueling with swords",
        "drawing a sword",
        "wielding a weapon",
        "aiming a bow",
        "casting a spell",
        "summoning magic",
        "transforming",
        "shielding their face",
        "screaming",
        "laughing",
        "crying",
        "gazing into the distance",
        "looking back over the shoulder",
        "reaching out",
        "holding a lantern aloft",
        "carrying a heavy load",
        "exploring cautiously",
        "sneaking through shadows",
        "charging into battle",
        "celebrating victory",
        "throwing a spear",
        "firing an arrow",
        "blocking with a shield",
        "parrying a blow",
        "rolling for cover",
        "vaulting over a wall",
        "sliding on knees",
        "galloping at full speed",
        "swinging on a rope",
        "surfing a wave",
        "paddling a canoe",
        "forging a blade",
        "brewing a potion",
        "inscribing runes",
        "sharpening a sword",
        "cradling a child",
        "whispering a secret",
        "sketching in a notebook",
        "painting at an easel",
        "unlocking a chest",
        "taming a beast",
        "leaping from a cliff",
        "emerging from water",
        "bowing deeply",
        "catching a falling object",
        "backflipping mid-air",
        "unleashing a battle cry",
        "shielding companions",
        "signaling with a flare",
        "peering through binoculars",
    ],
    "Style": [
        "photorealistic",
        "oil painting",
        "anime",
        "concept art",
        "watercolor",
        "pixel art",
        "cinematic",
        "sketch",
        "isometric",
        "low poly",
        "surrealism",
        "art nouveau",
        "baroque",
        "minimal vector",
        "charcoal drawing",
        "ukiyo-e",
        "pop art",
        "clay render",
        "film noir",
        "matte painting",
        "digital painting",
        "line art",
        "comic book",
        "manga",
        "graffiti",
        "vaporwave",
        "synthwave",
        "retrofuturism",
        "futurism",
        "dadaism",
        "cubism",
        "impressionism",
        "expressionism",
        "brutalism",
        "bauhaus",
        "constructivism",
        "rococo",
        "renaissance",
        "gothic",
        "art deco",
        "fauvism",
        "symbolism",
        "photobash",
        "storybook illustration",
        "editorial illustration",
        "low-key photography",
        "high-key photography",
        "infrared photography",
        "long exposure photography",
        "double exposure",
        "isometric diorama",
        "voxel art",
        "paper cutout",
        "stained glass",
        "woodblock print",
        "etching",
        "airbrush illustration",
        "mixed media collage",
        "art brut",
        "neo-expressionism",
        "abstract expressionism",
        "minimalism",
        "suprematism",
        "pointillism",
        "tenebrism",
        "chiaroscuro painting",
        "trompe l'oeil",
        "byzantine icon",
        "art deco poster",
        "russian propaganda poster",
        "psychedelic poster art",
        "1980s airbrush nostalgia",
        "70s pulp paperback cover",
        "1990s anime cel",
        "ghibli-inspired illustration",
        "dark fantasy illustration",
        "grimdark concept art",
        "ink wash painting",
        "sumi-e brushwork",
        "scratchboard illustration",
        "linocut print",
        "risograph print",
        "blueprint schematic",
        "technical isometric diagram",
        "claymation still",
        "stop-motion puppet",
        "cardboard diorama",
        "papercraft origami",
        "cross-stitch embroidery",
        "tapestry weave",
        "mosaic tile art",
        "lithograph",
    ],
    "Mood": [
        "dramatic",
        "serene",
        "eerie",
        "whimsical",
        "gritty",
        "romantic",
        "melancholic",
        "hopeful",
        "mysterious",
        "triumphant",
        "nostalgic",
        "tense",
        "playful",
        "ominous",
        "cozy",
        "awe-inspiring",
        "dreamlike",
        "ethereal",
        "foreboding",
        "joyful",
        "solemn",
        "chaotic",
        "tranquil",
        "brooding",
        "uplifting",
        "haunting",
        "bittersweet",
        "majestic",
        "intimate",
        "rebellious",
        "mystic",
        "suspenseful",
        "meditative",
        "oppressive",
        "radiant",
        "stoic",
        "violent",
        "curious",
        "vulnerable",
        "fierce",
        "dreamy",
        "celestial",
        "lonely",
        "festive",
        "restless",
        "peaceful",
        "uncanny",
        "graceful",
        "defiant",
        "enchanted",
        "urgent",
        "rompish",
        "reflective",
        "melodic",
        "weightless",
        "raw",
        "wistful",
        "yearning",
        "euphoric",
        "somber",
        "anxious",
        "serene awe",
        "quiet dread",
        "frenzied",
        "feverish",
        "hushed",
        "claustrophobic",
        "liberating",
        "sacred",
        "blasphemous",
        "tender",
        "savage",
        "exhilarating",
        "introspective",
        "apocalyptic",
        "elegiac",
        "wondrous",
        "harrowing",
        "comforting",
        "decadent",
        "ascetic",
        "hopeful melancholy",
        "primal",
        "regal",
        "forsaken",
        "rapturous",
        "unsettling calm",
    ],
    "Lighting": [
        "golden hour",
        "studio",
        "neon-lit",
        "overcast",
        "candlelight",
        "volumetric",
        "moonlight",
        "backlit silhouette",
        "rim lighting",
        "hard noon sun",
        "soft window light",
        "bioluminescent glow",
        "fog-diffused light",
        "firelight",
        "spotlight",
        "dappled forest light",
        "blue hour",
        "twilight",
        "sunrise glow",
        "sunset backlight",
        "harsh tungsten",
        "fluorescent overhead",
        "moonlit fog",
        "strobe flash",
        "rim-lit profile",
        "practical lamp light",
        "lantern glow",
        "torchlight",
        "lightning flash",
        "underlighting",
        "top-down skylight",
        "bounce-lit fill",
        "ambient occlusion light",
        "caustic underwater light",
        "projector beam",
        "laser grid",
        "holographic glow",
        "sodium vapor streetlight",
        "cabin window glow",
        "backstage stage-light",
        "rainy night reflections",
        "cave mouth daylight",
        "eclipse shadow light",
        "polar night glow",
        "aurora illumination",
        "god rays",
        "flickering neon",
        "monochrome noir lighting",
        "warm key cool fill",
        "split lighting",
        "silhouette against sunset",
        "specular highlight lighting",
        "motivation practical lighting",
        "candle chandelier light",
        "campfire rim light",
        "softbox portrait light",
    ],
    "Camera": [
        "wide angle",
        "macro",
        "portrait lens",
        "drone shot",
        "fisheye",
        "top-down",
        "worm's-eye view",
        "over-the-shoulder",
        "telephoto compression",
        "long exposure",
        "tilt-shift",
        "dutch angle",
        "close-up",
        "medium shot",
        "establishing shot",
        "extreme close-up",
        "full body shot",
        "cowboy shot",
        "insert shot",
        "point of view shot",
        "bird's-eye view",
        "high angle",
        "low angle",
        "eye level",
        "three-quarter view",
        "profile shot",
        "rear view",
        "tracking shot",
        "panning shot",
        "crane shot",
        "handheld frame",
        "steadycam glide",
        "anamorphic lens",
        "35mm lens",
        "50mm lens",
        "85mm lens",
        "200mm telephoto",
        "ultra-wide lens",
        "rack focus",
        "deep focus",
        "shallow depth of field",
        "long lens compression",
        "silhouette framing",
        "centered composition",
        "rule of thirds framing",
        "leading lines framing",
        "negative space framing",
        "framed through doorway",
        "overhead drone orbit",
        "split diopter look",
        "medium close-up",
        "wide establishing panorama",
        "hero shot",
        "candid snapshot",
        "first-person perspective",
    ],
    "Color": [
        "vibrant",
        "muted",
        "monochrome",
        "pastel",
        "earth tones",
        "neon",
        "duotone",
        "teal and orange",
        "high contrast",
        "desaturated",
        "warm palette",
        "cool palette",
        "jewel tones",
        "black and gold",
        "iridescent",
        "sepia",
        "pastel neon",
        "split complementary",
        "analogous palette",
        "triadic palette",
        "complementary contrast",
        "high saturation",
        "low saturation",
        "soft desaturation",
        "dusty tones",
        "sun-bleached palette",
        "moody blues",
        "emerald and amber",
        "crimson and cyan",
        "lavender haze",
        "rose gold accents",
        "copper patina",
        "deep shadows with highlights",
        "silver and charcoal",
        "warm sunset gradient",
        "cold moonlit tones",
        "acid colors",
        "earthy ochres",
        "rust and teal",
        "pastel gradient",
        "duochrome",
        "prismatic spectrum",
        "electric magenta",
        "ultraviolet hues",
        "forest greens",
        "desert sands",
        "oceanic blues",
        "autumn palette",
        "winter palette",
        "spring palette",
        "summer palette",
        "smoky neutrals",
        "golden monochrome",
        "neon noir palette",
        "opal iridescence",
        "candy palette",
    ],
    "Detail": [
        "highly detailed",
        "minimalist",
        "chaotic",
        "symmetrical",
        "intricate",
        "cinematic grain",
        "ultra sharp",
        "soft focus",
        "matte finish",
        "textured brushstrokes",
        "clean linework",
        "weathered surfaces",
        "micro details",
        "depth-rich layering",
        "ornate patterns",
        "subtle film noise",
        "hyper-detailed textures",
        "fine line engraving detail",
        "clean gradients",
        "heavy grain",
        "motion blur streaks",
        "crisp edge definition",
        "painterly strokes",
        "impasto texture",
        "silky smooth surfaces",
        "rough tactile surfaces",
        "dust particles in air",
        "water droplets",
        "fabric weave detail",
        "metallic reflections",
        "glass refraction",
        "subsurface scattering",
        "ambient haze",
        "layered foreground elements",
        "depth of atmosphere",
        "intricate ornamentation",
        "minimal negative space",
        "high dynamic range",
        "soft bloom",
        "lens flare accents",
        "chromatic aberration",
        "vignette framing",
        "volumetric fog",
        "sharp micro-contrast",
        "smooth tonal rolloff",
        "stylized noise texture",
        "edge wear and patina",
        "complex pattern tiling",
        "symmetry balance",
        "asymmetrical balance",
        "cinematic composition",
        "high fidelity rendering",
        "poster-ready clarity",
        "layered storytelling elements",
        "material realism",
        "rich textural contrast",
    ],
}


CATEGORY_TEMPLATES = {
    "Subject": [
        {
            "id": "subject_me",
            "label": "Me",
            "tags": [
                "lean build",
                "rugged features",
                "long red beard",
                "shaved head",
                "aviator sunglasses",
            ],
        }
    ],
    "Location": [],
    "Action": [],
    "Style": [],
    "Mood": [],
    "Lighting": [],
    "Camera": [],
    "Color": [],
    "Detail": [],
}
