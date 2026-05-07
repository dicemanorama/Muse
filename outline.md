# Image Prompt Builder — App Spec

## Overview

A Flask web app that helps users compose image generation prompts using pre-defined tag buttons, then refines them using a local Hermes3 8b LLM via Ollama. The final prompt is displayed in a copyable text area.

## Stack

- Backend: Python 3, Flask
- Frontend: Vanilla JS, CSS (no frameworks)
- LLM: Ollama local API (http://localhost:11434), model: hermes3:8b

## Project Structure

```
prompt-builder/
├── app.py
├── config.py
├── static/
│   ├── style.css
│   └── script.js
└── templates/
    └── index.html
```

## config.py

- `OLLAMA_URL` = `"http://localhost:11434/api/generate"`
- `MODEL_NAME` = `"hermes3:8b"`
- `SYSTEM_PROMPT`: instructs the model to return only a rich image gen prompt with no commentary, preamble, or explanation
- `TAGS` dict with these categories and example values:
  - **Subject:** person, landscape, creature, architecture, abstract, vehicle
  - **Style:** photorealistic, oil painting, anime, concept art, watercolor, pixel art, cinematic, sketch
  - **Mood:** dramatic, serene, eerie, whimsical, gritty, romantic
  - **Lighting:** golden hour, studio, neon-lit, overcast, candlelight, volumetric
  - **Camera:** wide angle, macro, portrait lens, drone shot, fisheye
  - **Color:** vibrant, muted, monochrome, pastel, earth tones, neon
  - **Detail:** highly detailed, minimalist, chaotic, symmetrical, intricate, cinematic grain

## app.py — Routes

### GET /

- Passes `TAGS` from config into `index.html` via `render_template`

### POST /generate

- Accepts JSON: `{ "tags": [...], "free_text": "..." }`
- Builds a prompt string from tags + free_text
- Calls Ollama API with `stream: true`
- Streams response back to frontend using Flask `stream_with_context`
- Returns plain text chunks

## templates/index.html

- Header with app title
- Tag button grid, grouped by category with a category label above each group
- Selected buttons are visually highlighted (toggled via JS)
- Free text input field below the tag grid
- Aspect ratio selector (separate, not sent to LLM): 1:1, 3:2, 16:9, 9:16, 4:5
- "Generate Prompt" button
- Output text area (read-only) where streamed result appears
- "Copy" button beneath the output area
- "Clear All" button to reset selections and output

## static/script.js

- Track selected tags in a JS `Set`
- Toggle button highlight on click
- On "Generate Prompt" click:
  - POST to `/generate` with `{ tags: [...], free_text }`
  - Read response as a `ReadableStream`
  - Decode chunks and append to output text area in real time
- Copy button writes output text area content to clipboard
- Clear All resets the Set, removes all active styles, clears output and free text field
- Aspect ratio selection is stored client-side only (displayed alongside the output for reference, not sent to the LLM)

## static/style.css

- Dark theme
- Tag buttons: pill-shaped, subtle default style, highlighted color when selected (accent color, e.g. indigo or teal)
- Category labels styled as small uppercase section headers
- Output text area: monospace font, dark background, good contrast
- Layout: single-column, max-width ~800px, centered
- Responsive: looks good down to mobile widths
