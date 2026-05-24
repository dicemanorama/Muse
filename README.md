# Muse - Image Prompt Builder

A Flask web app for generating high-quality image prompts with OpenRouter cloud models or local Ollama models. It supports Midjourney-style and SDXL/ComfyUI outputs, tag-based prompt composition, streaming generation, prompt refinement, and saved favorites.

## Features

- Tag-driven prompt composition across Subject, Style, Mood, Lighting, Camera, Color, and Detail
- Free-text input for custom instructions
- Two output modes:
  - **Midjourney** (single final prompt + MJ parameter controls)
  - **SDXL / ComfyUI** (`POSITIVE` and `NEGATIVE` prompt format + generation settings)
- Model picker with both:
  - OpenRouter cloud model (configured via `OPENROUTER_MODEL`)
  - Local Ollama models (auto-discovered from `/api/tags`)
- Token streaming for both generate and refine flows
- Favorites workflow in the UI

## Tech Stack

- Python 3
- Flask
- Gunicorn (production)
- Vanilla HTML/CSS/JavaScript
- OpenRouter Chat Completions API
- Ollama API (optional, local)

## Project Layout

```text
.
├── prompt-builder/
│   ├── app.py
│   ├── config.py
│   ├── templates/
│   │   └── index.html
│   └── static/
│       ├── style.css
│       └── script.js
├── requirements.txt
├── env.example
├── launch.bat
└── .env
```

## Prerequisites

- Python 3.10+ (3.11 recommended)
- An [OpenRouter](https://openrouter.ai/) API key for cloud generation
- (Optional) [Ollama](https://ollama.com/) running locally if you want local models

## Setup

1. Clone or open this repo.
2. Create and activate a virtual environment.
3. Install dependencies from `requirements.txt`.
4. Copy `env.example` to `.env` and fill in your values.

### Windows quick start (recommended)

Run:

```bat
launch.bat
```

`launch.bat` will:
- create `venv` if missing
- install dependencies
- start Flask from `prompt-builder/app.py`
- optionally start an ngrok tunnel

### Manual setup

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python .\prompt-builder\app.py
```

Then open:

[http://localhost:5000](http://localhost:5000)

### Production (Linux)

Run from the repo with gunicorn:

```bash
/path/to/Muse/venv/bin/gunicorn \
  -w 2 \
  -b 127.0.0.1:5002 \
  --chdir /path/to/Muse/prompt-builder \
  --timeout 600 \
  app:app
```

Place `.env` at the repo root. Use an absolute path for `STORAGE_DB_PATH` on the server if you override it.

## Environment Variables

Defined in `.env` (repo root):

- `OPENROUTER_API_KEY` — your OpenRouter API key (required for cloud generation)
- `OPENROUTER_MODEL` (default: `google/gemma-3-12b-it`) — model ID sent to OpenRouter
- `OLLAMA_URL` (default: `http://localhost:11434/api/generate`)
- `OLLAMA_MODEL` (default: `hermes3:8b`) — fallback default when no OpenRouter key is set
- `STORAGE_DB_PATH` (optional; SQLite file path for saved prompts/templates, default: `prompt-builder/storage.db`)

If `OPENROUTER_API_KEY` is missing, the OpenRouter model appears disabled in the UI and Ollama-only usage still works.

## Running with Ollama

1. Start Ollama.
2. Ensure at least one model is available (example: `hermes3:8b`).
3. Keep `OLLAMA_URL` pointed to your Ollama `/api/generate` endpoint.
4. Launch the app and select your model in the UI.

## API Endpoints

- `GET /` - UI
- `GET /templates` - list user-created templates
- `POST /templates` - create user template
- `DELETE /templates/<template_id>` - delete user template
- `GET /saved-prompts` - list saved prompts
- `POST /saved-prompts` - save prompt favorite
- `DELETE /saved-prompts/<prompt_id>` - delete saved prompt
- `GET /models` - available Ollama + OpenRouter model metadata
- `POST /warmup` - warm model and return load timing
- `POST /generate` - stream generated prompt text
- `POST /refine` - stream refined prompt text

## Notes

- The app streams responses to the browser, so first-token latency depends on model/provider startup time.
- Saved prompts and user templates are persisted in SQLite (`prompt-builder/storage.db` by default).
- Existing `templates.json` entries are auto-imported on first run if the database table is empty.
- Legacy browser `localStorage` favorites are migrated once on first load of the updated UI.
