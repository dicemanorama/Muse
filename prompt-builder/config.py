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
MODEL_NAME = os.environ.get("OLLAMA_MODEL", "hermes3:8b")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_BASE_URL = os.environ.get(
    "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
).strip().rstrip("/")

if not GROQ_API_KEY:
    print(
        "[config] GROQ_API_KEY is empty; Groq models will appear as unavailable in the UI.",
        file=sys.stderr,
    )

GROQ_MODELS = [
    {
        "id": "llama-3.3-70b-versatile",
        "label": "Llama 3.3 70B (versatile)",
        "parameter_size": "70B",
    },
    {
        "id": "llama-3.1-8b-instant",
        "label": "Llama 3.1 8B (instant)",
        "parameter_size": "8B",
    },
    {
        "id": "meta-llama/llama-4-scout-17b-16e-instruct",
        "label": "Llama 4 Scout 17B",
        "parameter_size": "17B",
    },
    {
        "id": "meta-llama/llama-4-maverick-17b-128e-instruct",
        "label": "Llama 4 Maverick 17B",
        "parameter_size": "17B",
    },
    {
        "id": "moonshotai/kimi-k2-instruct",
        "label": "Kimi K2 (Moonshot)",
        "parameter_size": "1T",
    },
    {
        "id": "gemma2-9b-it",
        "label": "Gemma 2 9B",
        "parameter_size": "9B",
    },
]


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
    "- You may use double-colon weighted emphasis sparingly to anchor the most important element "
    "  (e.g. 'ancient dragon::2, mist-veiled canyon'). Use at most one weighted phrase per prompt.\n"
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
